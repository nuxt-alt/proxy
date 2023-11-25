import * as http from 'node:http'
import * as net from 'node:net'
import { createProxyServer, type ProxyServer, type Server } from '@refactorjs/http-proxy'
import { defineEventHandler, type H3Event } from 'h3'
import { options } from '#nuxt-proxy-options'
import { pathToFileURL } from 'node:url'
import colors from 'picocolors'

interface ProxyOptions extends Server.ServerOptions {
    /**
     * rewrite path
     */
    rewrite?: ((
        path: string
    ) => string | null | undefined | false) | false

    /**
     * configure the proxy server (e.g. listen to events)
     */
    configure?: ((
        proxy: ProxyServer,
        options: ProxyOptions
    ) => void | null | undefined | false) | false

    /**
     * configure the proxy server (e.g. listen to events)
     */
    configureWithEvent?: ((
        proxy: ProxyServer,
        options: ProxyOptions,
        event: H3Event
    ) => void | null | undefined | false) | false

    /**
     * webpack-dev-server style bypass function
     */
    bypass?: ((
        req: http.IncomingMessage,
        res: http.ServerResponse,
        options: ProxyOptions
    ) => void | null | undefined | false | string) | false
}

// lazy require only when proxy is used
const proxies: Record<string, [ProxyServer, ProxyOptions]> = {}
const functionNames = ['rewrite', 'configure', 'configureWithEvent', 'bypass'];

Object.keys(options.proxies!).forEach(async (context, index) => {
    let opts = initializeOpts(options.proxies![context]);

    if (!opts) return

    await Promise.all(functionNames.map(async (name) => getFunction(opts, name, index)));

    const proxy = createProxyServer(opts)

    if (opts.configure) {
        opts.configure(proxy, opts)
    }

    proxy.on('error', (err, req, originalRes) => {
        // When it is ws proxy, res is net.Socket
        // originalRes can be falsy if the proxy itself errored
        const res = originalRes as http.ServerResponse | net.Socket | undefined

        if (!res) {
            console.error(`${colors.red(`http proxy error: ${err.message}`)}\n${err.stack}`)
        } else if ('req' in res) {
            console.error(`${colors.red(`http proxy error at ${originalRes.req.url}:`)}\n${err.stack}`)
            if (!res.headersSent && !res.writableEnded) {
                res.writeHead(500, {
                    'Content-Type': 'text/plain',
                })
                    .end()
            }
        } else {
            console.error(`${colors.red(`ws proxy error:`)}\n${err.stack}`)
            res.end()
        }
    })

    proxy.on('proxyReqWs', (proxyReq, req, options, socket, head) => {
        socket.on('error', (err) => {
            console.error(`${colors.red(`ws proxy socket error:`)}\n${err.stack}`)
        })
    })

    proxy.on('proxyRes', (proxyRes, req, res) => {
        res.on('close', () => {
            if (!res.writableEnded) {
                debug('destroying proxyRes in proxyRes close event')
                proxyRes.destroy()
            }
        })
    })

    // clone before saving because http-proxy mutates the options
    proxies[context] = [proxy, { ...opts }]
})

export default defineEventHandler(async (event) => {
    await new Promise<void>((resolve, reject) => {
        const next = (err?: unknown) => {
            if (err) {
                reject(err)
            } else {
                resolve()
            }
        }

        // @ts-ignore: server property exists
        const httpServer = event.node.res.socket?.server as http.Server

        if (httpServer) {
            httpServer.on('upgrade', (req, socket, head) => {
                const url = req.url!
                for (const context in proxies) {
                    if (doesProxyContextMatchUrl(context, url)) {
                        const [proxy, opts] = proxies[context]
                        if ( opts.ws || opts.target?.toString!().startsWith('ws:') || opts.target?.toString!().startsWith('wss:') ) {
                            if (opts.rewrite) {
                                req.url = opts.rewrite(url) as string
                            }
                            debug(`${req.url} -> ws ${opts.target}`)
                            proxy.ws(req, socket as net.Socket, head)
                            return
                        }
                    }
                }
            })
        }

        const url = event.node.req.url!

        for (const context in proxies) {
            if (doesProxyContextMatchUrl(context, url)) {
                const [proxy, opts] = proxies[context]
                const options: Server.ServerOptions = {}

                if (opts.configureWithEvent) {
                    opts.configureWithEvent(proxy, opts, event)
                }

                if (opts.bypass) {
                    const bypassResult = opts.bypass(event.node.req, event.node.res, opts)
                    if (typeof bypassResult === 'string') {
                        event.node.req.url = bypassResult
                        debug('bypass: ' + event.node.req.url + ' -> ' + bypassResult)
                        return next()
                    } else if (bypassResult === false) {
                        debug('bypass: ' + event.node.req.url + ' -> 404')
                        event.node.res.statusCode = 404
                        return event.node.res.end()
                    }
                }

                if (opts.rewrite) {
                    event.node.req.url = opts.rewrite(event.node.req.url!) as string
                }

                debug(event.node.req.url + ' -> ' + opts.target || opts.forward)

                proxy.web(event.node.req, event.node.res, options)
                return;
            }
        }
        next()
    })
})

function debug(message?: any) {
    if (options.debug) {
        console.log(message)
    }
}

async function getFunction(opts: ProxyOptions, functionName: string, index: number) {
    if (opts[functionName as keyof ProxyOptions]) {
        const filePath = options.isDev && process.platform === 'win32' ? pathToFileURL(options.buildDir).href : options.buildDir
        const functionModule = await import(`${filePath}/nuxt-proxy-functions.mjs`).then((output) => output.default || output)
        opts[functionName as keyof ProxyOptions] = functionModule[index][functionName]
    }

    return opts
}

function initializeOpts(optsInput: ProxyOptions | string) {
    let opts = optsInput;
    if (typeof opts === 'string') opts = { target: opts, changeOrigin: true } as ProxyOptions;
    if (typeof opts === 'object') opts = { changeOrigin: true, ...opts } as ProxyOptions;
    return opts;
}

function doesProxyContextMatchUrl(context: string, url: string): boolean {
    return (
        (context[0] === '^' && new RegExp(context).test(url)) || url.startsWith(context)
    )
}
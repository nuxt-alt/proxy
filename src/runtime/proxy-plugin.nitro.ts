import * as http from 'node:http'
import * as net from 'node:net'
import { createProxyServer, type ProxyServer, type Server } from '@refactorjs/http-proxy'
import { defineEventHandler, type H3Event } from 'h3'
import { options } from '#nuxt-proxy-options'

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

Object.keys(options.proxies!).forEach(async (context) => {
    let opts = initializeOpts(options.proxies![context]);

    if (!opts) return

    if (options.experimental.importFunctions) {
        functionNames.forEach(async name => await getFunction(opts, name));
    }  
    else {
        functionNames.forEach(name => opts[name as keyof ProxyOptions] = opts[name as keyof ProxyOptions] ? new Function("return (" + opts[name as keyof ProxyOptions] + ")")() : undefined);
    }

    const proxy = createProxyServer(opts)

    proxy.on('error', (err, req, originalRes) => {
        // When it is ws proxy, res is net.Socket
        const res = originalRes as http.ServerResponse | net.Socket
        if ('req' in res) {
            console.error('http proxy error:' + err.stack, {
                timestamp: true,
                error: err
            })
            if (!res.headersSent && !res.writableEnded) {
                res.writeHead(500, {
                    'Content-Type': 'text/plain'
                })
                .end()
            }
        } else {
            console.error('ws proxy error:' + err.stack, {
                timestamp: true,
                error: err
            })
            res.end()
        }
    })

    if (opts.configure) {
        opts.configure(proxy, opts)
    }

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
                    } else if (isObject(bypassResult)) {
                        Object.assign(options, bypassResult)
                        debug('bypass: ' + event.node.req.url + ' use modified options: %O', options)
                        return next()
                    } else if (bypassResult === false) {
                        debug('bypass: ' + event.node.req.url + ' -> 404')
                        return event.node.res.end(404)
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

function debug (message?: any, ...optionalParams: any[]) {
    if (options.debug) {
        console.log(message, optionalParams)
    }
}

async function getFunction(opts: ProxyOptions, functionName: string) {
    if (opts[functionName as keyof ProxyOptions]) {
        const functionModule = await import(`${options.buildDir}/${functionName}`)
        opts[functionName as keyof ProxyOptions] = functionModule.default[opts[functionName as keyof ProxyOptions]]
    }
}

function initializeOpts(optsInput: ProxyOptions | string) {
    let opts = optsInput;
    if (typeof opts === 'string') opts = { target: opts, changeOrigin: true } as ProxyOptions;
    if (typeof opts === 'object') opts = { changeOrigin: true, ...opts } as ProxyOptions;
    return opts;
}

function isObject(value: unknown): value is Record<string, any> {
    return Object.prototype.toString.call(value) === '[object Object]'
}

function doesProxyContextMatchUrl(context: string, url: string): boolean {
    return (
        (context.startsWith('^') && new RegExp(context).test(url)) || url.startsWith(context)
    )
}
import * as H3 from 'h3'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import type { NitroAppPlugin, NitroRuntimeConfig } from 'nitropack'
import { createProxyServer, type ProxyServer, type Server } from '@refactorjs/http-proxy'
import { eventHandler, type H3Event } from 'h3'
// @ts-expect-error: alias
import { useRuntimeConfig } from '#internal/nitro'
// @ts-expect-error: virtual file
import { options } from '#nuxt-proxy-options'
import colors from 'picocolors'

interface ProxyOptions extends Server.ServerOptions {
    /**
     * rewrite path
     */
    rewrite?: ((
        path: string
    ) => string | null | undefined | false)

    /**
     * configure the proxy server (e.g. listen to events)
     */
    configure?: ((
        proxy: ProxyServer,
        options: ProxyOptions,
        runtimeConfig: NitroRuntimeConfig
    ) => void | null | undefined | false)

    /**
     * configure the proxy server (e.g. listen to events) with nitro event
     */
    configureWithEvent?: ((
        proxy: ProxyServer,
        options: ProxyOptions,
        runtimeConfig: NitroRuntimeConfig,
        event: H3Event,
        h3: typeof H3
    ) => void | null | undefined | false | H3Event)

    /**
     * webpack-dev-server style bypass function
     */
    bypass?: ((
        req: IncomingMessage,
        res: ServerResponse,
        options: ProxyOptions,
        runtimeConfig: NitroRuntimeConfig
    ) => void | null | undefined | false | string)
}

// lazy require only when proxy is used
const proxies: Record<string, [ProxyServer, ProxyOptions]> = {}

Object.keys(options.proxies!).forEach(async (context) => {
    let opts = initializeOpts(options.proxies![context]);

    if (!opts) return

    const proxy = createProxyServer(opts)

    if (opts.configure) {
        opts.configure(proxy, opts, useRuntimeConfig() as NitroRuntimeConfig)
    }

    proxy.on('error', (err, req, originalRes) => {
        // When it is ws proxy, res is net.Socket
        // originalRes can be falsy if the proxy itself errored
        const res = originalRes as ServerResponse | Socket | undefined

        if (!res) {
            console.error(`${colors.red(`http proxy error: ${err.message}`)}\n${err.stack}`)
        } else if ('req' in res) {
            console.error(`${colors.red(`http proxy error at ${(originalRes as ServerResponse).req.url}:`)}\n${err.stack}`)
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

export default <NitroAppPlugin> function (nitroApp) {
    nitroApp.h3App.stack.unshift({
        route: '/',
        handler: eventHandler(async (event) => {
            await new Promise<void>(async (resolve, reject) => {
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
                            const H3 = await import('h3')
                            opts.configureWithEvent(proxy, opts, useRuntimeConfig() as NitroRuntimeConfig, event, H3)
                        }

                        if (opts.bypass) {
                            const bypassResult = opts.bypass(event.node.req, event.node.res, opts, useRuntimeConfig() as NitroRuntimeConfig)
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
                        return
                    }
                }
                next()
            })
        })
    })
}

function debug(message?: any) {
    if (options.debug) {
        console.log(message)
    }
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
import type { NitroAppPlugin, NitroRuntimeConfig } from 'nitropack'
import type { Socket } from 'node:net'
import { createProxyServer, type ProxyServer, type Server } from '@refactorjs/http-proxy'
// @ts-expect-error: virtual file
import { options } from '#nuxt-proxy-options'
// @ts-expect-error: alias
import { useRuntimeConfig } from '#internal/nitro'
import colors from 'picocolors'

interface ProxyOptions extends Server.ServerOptions {
    /**
     * configure the proxy server (e.g. listen to events)
     */
    configure?: ((
        proxy: ProxyServer,
        options: ProxyOptions,
        runtimeConfig: NitroRuntimeConfig
    ) => void | null | undefined | false)

    /**
     * rewrite path
     */
    rewrite?: ((
        path: string
    ) => string | null | undefined | false)
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

    proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
        socket.on('error', (err) => {
            console.error(`${colors.red(`ws proxy socket error:`)}\n${err.stack}`)
        })
    })

    // clone before saving because http-proxy mutates the options
    proxies[context] = [proxy, { ...opts }]
})

export default <NitroAppPlugin>function (nitroApp) {
    nitroApp.hooks.hook('listen:node', (server) => {
        server.on('upgrade', async (req, socket: Socket, head) => {
            const url = req.url!
            for (const context in proxies) {
                if (doesProxyContextMatchUrl(context, url)) {
                    const [proxy, opts] = proxies[context]
                    if (opts.ws || opts.target?.toString!().startsWith('ws:') || opts.target?.toString!().startsWith('wss:')) {
                        if (opts.rewrite) {
                            req.url = opts.rewrite(url) as string
                        }
                        debug(`${req.url} -> ws ${opts.target}`)
                        proxy.ws(req, socket, head)
                        return
                    }
                }
            }
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
    if (typeof opts === 'string') opts = { target: opts, changeHost: true } as ProxyOptions;
    if (typeof opts === 'object') opts = { changeHost: true, ...opts } as ProxyOptions;
    return opts;
}

function doesProxyContextMatchUrl(context: string, url: string): boolean {
    return (
        (context[0] === '^' && new RegExp(context).test(url)) || url.startsWith(context)
    )
}
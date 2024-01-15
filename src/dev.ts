import { type ProxyServer, createProxyServer } from '@refactorjs/http-proxy'
import type { ModuleOptions, ProxyOptions } from './types'
import type { NitroRuntimeConfig } from 'nitropack'
import { type Nuxt } from '@nuxt/schema'
import type { Socket } from 'node:net'
import colors from 'picocolors'

export function handleDevWsProxy(options: ModuleOptions, nuxt: Nuxt) {
    // lazy require only when proxy is used
    const proxies: Record<string, [ProxyServer, ProxyOptions]> = {}

    Object.keys(options.proxies!).forEach(async (context) => {
        let opts = initializeOpts(options.proxies![context] as ProxyOptions);

        if (!opts) return

        const proxy = createProxyServer(opts)

        if (opts.configure) {
            opts.configure(proxy, opts, nuxt.options.runtimeConfig as NitroRuntimeConfig)
        }

        proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
            socket.on('error', (err) => {
                console.error(`${colors.red(`ws proxy socket error:`)}\n${err.stack}`)
            })
        })

        // clone before saving because http-proxy mutates the options
        proxies[context] = [proxy, { ...opts }]
    })

    nuxt.hook('listen', (server) => {
        server.on('upgrade', (req, socket: Socket, head) => {
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

function debug(message?: any, options?: ModuleOptions) {
    if (options?.debug) {
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
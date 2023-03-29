import { addServerHandler, addServerPlugin, addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { name, version } from '../package.json'
import { ModuleOptions, ProxyOptions } from './types'
import { defu } from 'defu'

const CONFIG_KEY = 'proxy'

export default defineNuxtModule({
    meta: {
        name,
        version,
        configKey: CONFIG_KEY
    },
    defaults: {
        enableProxy: true,
        fetch: false
    },
    setup(options, nuxt) {
        const config = (nuxt.options.runtimeConfig.proxy = defu(nuxt.options.runtimeConfig.proxy, options)) as ModuleOptions
        const resolver = createResolver(import.meta.url)
        const defaultHost = process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || 'localhost'
        const defaultPort = process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3000
        const defaultProtocol = process.env.NITRO_SSL_CERT && process.env.NITRO_SSL_KEY ? 'https://' : 'http://'

        if (config.enableProxy) {
            // Create Proxy
            addTemplate({ 
                filename: 'nuxt-proxy.ts', 
                write: true,
                getContents: () => proxyMiddlewareContent(config.proxies ?? {})
            })

            addServerHandler({
                handler: resolver.resolve(nuxt.options.buildDir, 'nuxt-proxy.ts'), 
                middleware: true
            })
        }

        // Don't know if it runs on windows still.
        if (config.fetch) {
            // create nitro plugin
            addTemplate({
                getContents: () => nitroFetchProxy(defaultHost, defaultPort, defaultProtocol),
                filename: 'nitro-fetch.mjs',
                write: true
            })

            addServerPlugin(resolver.resolve(nuxt.options.buildDir, 'nitro-fetch.mjs'))
        }
    }
})

function nitroFetchProxy(host: string, port: number | string, protocol: string): string {
return `import { createFetch, Headers } from 'ofetch'

export default function (nitroApp) {
    // the proxy module needs the host and port of the nitro server in order for it to proxy it properly.
    // By default only a path is being submitted so this will chnage it to the host and port
    globalThis.$fetch = createFetch({ fetch: nitroApp.localFetch, Headers, defaults: { baseURL: '${protocol}${host}:${port}' } })
}
`
}

function converter(key: string, val: any) {
    if (typeof val === 'function' || val && val.constructor === RegExp) {
        return String(val)
    }
    return val
}

function proxyMiddlewareContent(options: ProxyOptions): string {
    return `import * as http from 'node:http'
import * as net from 'node:net'
import { createProxyServer, ProxyServer, Server } from '@refactorjs/http-proxy'
import { defineEventHandler } from 'h3'

interface ProxyOptions extends Server.ServerOptions {
    /**
     * rewrite path
     */
    rewrite?: (path: string) => string | null | undefined | false

    /**
     * configure the proxy server (e.g. listen to events)
     */
    configure?: (proxy: ProxyServer, options: ProxyOptions) => void | null | undefined | false

    /**
     * webpack-dev-server style bypass function
     */
    bypass?: (
        req: http.IncomingMessage,
        res: http.ServerResponse,
        options: ProxyOptions
    ) => void | null | undefined | false | string
}

// lazy require only when proxy is used
const proxies: Record<string, [ProxyServer, ProxyOptions]> = {}
const options: { [key: string]: string | ProxyOptions } | undefined = ${JSON.stringify(options, converter)};

Object.keys(options!).forEach((context) => {
    let opts = options![context]

    if (!opts) return

    if (typeof opts === 'string') {
        opts = { target: opts, changeOrigin: true } as ProxyOptions
    }

    if (isObject(opts)) {
        opts = { changeOrigin: true, ...opts } as ProxyOptions
        opts.rewrite = opts.rewrite ? new Function("return (" + opts.rewrite + ")")() : false
        opts.configure = opts.configure ? new Function("return (" + opts.configure + ")")() : false
        opts.bypass = opts.bypass ? new Function("return (" + opts.bypass + ")")() : false
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

                if (opts.bypass) {
                    const bypassResult = opts.bypass(event.node.req, event.node.res, opts)
                    if (typeof bypassResult === 'string') {
                        event.node.req.url = bypassResult
                        console.debug('bypass: ' + event.node.req.url + ' -> ' + bypassResult)
                        return next()
                    } else if (isObject(bypassResult)) {
                        Object.assign(options, bypassResult)
                        console.debug('bypass: ' + event.node.req.url + ' use modified options: %O', options)
                        return next()
                    } else if (bypassResult === false) {
                        console.debug('bypass: ' + event.node.req.url + ' -> 404')
                        return event.node.res.end(404)
                    }
                }

                console.debug(event.node.req.url + ' -> ' + opts.target || opts.forward)

                if (opts.rewrite) {
                    event.node.req.url = opts.rewrite(event.node.req.url!) as string
                }

                proxy.web(event.node.req, event.node.res, options)
                return
            }
        }
        next()
    })
})

function isObject(value: unknown): value is Record<string, any> {
    return Object.prototype.toString.call(value) === '[object Object]'
}

function doesProxyContextMatchUrl(context: string, url: string): boolean {
    return (
        (context.startsWith('^') && new RegExp(context).test(url)) || url.startsWith(context)
    )
}
`
}
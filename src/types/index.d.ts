import type { ProxyServer, Server } from '@refactorjs/http-proxy'
import type { IncomingMessage, ServerResponse } from 'node:http'
import * as NuxtSchema from '@nuxt/schema';
import type { H3Event } from 'h3'

export interface ModuleOptions {
    enableProxy?: boolean
    proxies?: {
        [key: string]: string | ProxyOptions
    }
    experimental: {
        fetch?: boolean
        importFunctions?: boolean
    }
}

export interface ProxyOptions extends Server.ServerOptions {
    /**
     * rewrite path
     */
    rewrite?: string | ((path: string) => string | null | undefined | false)

    /**
     * configure the proxy server (e.g. listen to events)
     */
    configure?: string | ((proxy: ProxyServer, options: ProxyOptions) => void | null | undefined | false)

    /**
     * configure the proxy server (e.g. listen to events)
     */
    configureWithEvent?: string | ((proxy: ProxyServer, options: ProxyOptions, event: H3Event) => void | null | undefined | false)

    /**
     * webpack-dev-server style bypass function
     */
    bypass?: string | ((
        req: IncomingMessage,
        res: ServerResponse,
        options: ProxyOptions
    ) => void | null | undefined | false | string)
}

declare const NuxtProxy: NuxtSchema.NuxtModule<ModuleOptions>

export default NuxtProxy
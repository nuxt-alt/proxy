import type { ProxyServer, Server } from '@refactorjs/http-proxy'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { NitroRuntimeConfig } from 'nitropack'
import type { H3Event } from 'h3'
import * as http from 'node:http'
import * as https from 'node:https'
import * as NuxtSchema from '@nuxt/schema'
import * as H3 from 'h3'

export interface ModuleOptions {
    debug?: boolean
    // Experimental
    experimental?: {
        listener?: boolean
    }
    proxies?: {
        [key: string]: string | ProxyOptions | undefined
    }
}

declare module 'nitropack' {
    interface NitroRuntimeHooks {
        'listen:node': (server: http.Server | https.Server) => void
    }
}

declare module '@nuxt/schema' {
    interface NuxtConfig {
        ['proxy']?: Partial<ModuleOptions>
    }
    interface NuxtOptions {
        ['proxy']?: ModuleOptions
    }
}

export interface ProxyOptions extends Server.ServerOptions {
    /**
     * rewrite path
     */
    rewrite?: ((path: string) => string | null | undefined | false)

    /**
     * configure the proxy server (e.g. listen to events)
     */
    configure?: ((proxy: ProxyServer, options: ProxyOptions, runtimeConfig: NitroRuntimeConfig) => void | null | undefined | false)

    /**
     * configure the proxy server (e.g. listen to events) with nitro event.
     * This runs before being sent to proxy.web() so you can alter the event
     * and return it.
     */
    configureWithEvent?: ((proxy: ProxyServer, options: ProxyOptions, runtimeConfig: NitroRuntimeConfig, event: H3Event, h3: typeof H3) => void | null | undefined | false | H3Event)

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

declare const NuxtProxy: NuxtSchema.NuxtModule<ModuleOptions>

export default NuxtProxy
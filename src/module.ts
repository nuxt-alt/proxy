import type { ModuleOptions } from './types'
import { createResolver, defineNuxtModule, addServerHandler } from '@nuxt/kit'
import { handleDevWsProxy } from './dev'
import { serialize } from '@refactorjs/serialize'
import { name, version } from '../package.json'
import { defu } from 'defu'

const CONFIG_KEY = 'proxy'

export default defineNuxtModule({
    meta: {
        name,
        version,
        configKey: CONFIG_KEY,
        compatibility: {
            nuxt: '^3.0.0'
        }
    },
    defaults: ({ options }) => ({
        proxies: {},
        debug: options.dev ? true : false,
        experimental: {
            listener: false
        }
    }),
    async setup(options, nuxt) {
        const resolver = createResolver(import.meta.url)
        const moduleConfig = (nuxt.options.runtimeConfig.proxy = defu(nuxt.options.runtimeConfig.proxy as any, options)) as ModuleOptions

        const runtimeDir = resolver.resolve('./runtime')
        nuxt.options.build.transpile.push(runtimeDir)

        if (nuxt.options.dev && moduleConfig.experimental?.listener) {
            handleDevWsProxy(moduleConfig, nuxt)
        }

        addServerHandler({
            handler: resolver.resolve(runtimeDir, 'proxy-handler.nitro'),
            middleware: true
        })

        if (moduleConfig.experimental?.listener && !nuxt.options.dev) {
            addServerHandler({
                handler: resolver.resolve(runtimeDir, 'socket-handler.nitro'),
                middleware: true
            })
        }

        nuxt.hook('nitro:config', (config) => {
            config.externals = config.externals || {}
            config.externals.inline = config.externals.inline || []
            config.externals.inline.push(runtimeDir)

            config.virtual = config.virtual || {}
            config.virtual['#nuxt-proxy-options'] = `export const options = ${serialize(moduleConfig, { space: 4 })}`
            config.plugins = config.plugins || []

            if (moduleConfig.experimental?.listener && !nuxt.options.dev) {
                config.plugins.push(resolver.resolve(runtimeDir, 'socket-plugin.nitro'))
            }
        })
    }
})
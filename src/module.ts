import { addServerHandler, addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { name, version } from '../package.json'
import { ModuleOptions } from './types'
import { defu } from 'defu'
import { existsSync, promises as fsp } from 'node:fs'
import { Nuxt } from '@nuxt/schema'

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
        enableProxy: true,
        buildDir: options.buildDir,
        debug: options.dev ? true : false,
        experimental: {
            importFunctions: false
        }
    }),
    async setup(options, nuxt) {
        const resolver = createResolver(import.meta.url)
        const moduleConfig = (nuxt.options.runtimeConfig.proxy = defu(nuxt.options.runtimeConfig.proxy as any, options)) as ModuleOptions

        const runtimeDir = await resolver.resolve('./runtime')
        nuxt.options.build.transpile.push(runtimeDir)

        nuxt.hook('nitro:config', (config) => {
            config.externals = config.externals || {}
            config.externals.inline = config.externals.inline || []
            config.externals.inline.push(runtimeDir)

            config.virtual = config.virtual || {}
            config.virtual['#nuxt-proxy-options'] = `export const options = ${JSON.stringify(moduleConfig, null, 2)}`
        })

        if (moduleConfig.enableProxy) {
            if (moduleConfig.experimental.importFunctions) {
                await createProxyFunctions(nuxt)
                addTemplate({ filename: 'rewrite.ts', write: true, src: resolver.resolve(nuxt.options.srcDir, 'proxy/rewrite.ts') })
                addTemplate({ filename: 'configure.ts', write: true, src: resolver.resolve(nuxt.options.srcDir, 'proxy/configure.ts') })
                addTemplate({ filename: 'configure-event.ts', write: true, src: resolver.resolve(nuxt.options.srcDir, 'proxy/configure-event.ts') })
                addTemplate({ filename: 'bypass.ts', write: true, src: resolver.resolve(nuxt.options.srcDir, 'proxy/bypass.ts') })
            }

            addServerHandler({
                handler: resolver.resolve(runtimeDir, 'proxy-plugin.nitro'),
                middleware: true
            })
        }
    }
})

async function createProxyFunctions(nuxt: Nuxt) {
    const resolver = createResolver(import.meta.url)
    const proxyPath = resolver.resolve(nuxt.options.srcDir, 'proxy')

    if (!existsSync(proxyPath)) {
        await fsp.mkdir(proxyPath, { recursive: true })
    }

    if (!existsSync(proxyPath + '/rewrite.ts')) {
        fsp.writeFile(proxyPath + '/rewrite.ts', 'export default {}')
    }

    if (!existsSync(proxyPath + '/configure.ts')) {
        fsp.writeFile(proxyPath + '/configure.ts', 'export default {}')
    }

    if (!existsSync(proxyPath + '/configure-event.ts')) {
        fsp.writeFile(proxyPath + '/configure-event.ts', 'export default {}')
    }

    if (!existsSync(proxyPath + '/bypass.ts')) {
        fsp.writeFile(proxyPath + '/bypass.ts', 'export default {}')
    }
}
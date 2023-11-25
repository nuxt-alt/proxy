import { addServerHandler, addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { name, version } from '../package.json'
import type { ModuleOptions, ProxyOptions } from './types'
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
        buildDir: options.buildDir,
        isDev: options.dev,
        debug: options.dev ? true : false
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
            config.virtual['#nuxt-proxy-options'] = `export const options = ${JSON.stringify(moduleConfig, converter, 2)}`
        })

        await createProxyFunctions(moduleConfig)

        addServerHandler({
            handler: resolver.resolve(runtimeDir, 'proxy-plugin.nitro'),
            middleware: true
        })
    }
})

function converter(key: string, val: any) {
    if (val && val.constructor === RegExp) {
        return String(val)
    }

    if (typeof val === 'function') {
        return true
    }

    return val
}

async function createProxyFunctions(options: ModuleOptions) {
    addTemplate({
        filename: 'nuxt-proxy-functions.mjs',
        write: true,
        getContents: () => {
            let idx = 0;
            let contents = 'export default {';

            for (let key in options.proxies) {
                let option = options.proxies[key];

                // Check if option is an object
                if (typeof option === 'object') {
                    let tempContents = '';
                    let hasFunction = false;

                    // Loop through the properties in the option object
                    for (let prop in option) {
                        // Check if the property is a function
                        if (typeof option[prop as keyof ProxyOptions] === 'function') {
                            // Append the function to tempContents
                            tempContents += `\n ${prop}: ${option[prop as keyof ProxyOptions]},`;
                            hasFunction = true;
                        }
                    }

                    // Only if the option had at least one function, append to contents
                    if (hasFunction) {
                        contents += '\n' + idx + ': {' + tempContents + '\n },';
                    }
                }

                idx++;
            }

            contents += '\n}';

            return contents;
        }
    })
}
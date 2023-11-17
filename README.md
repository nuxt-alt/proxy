> Proxy module for [Nuxt](https://nuxt.com)

## Info

This serves as an alternative for @nuxtjs-alt/proxy. Please note that this is for nuxt 3 only. The config is similar to what vite has except that this one creates a physical file which is needed for production.

## Setup

1. Add `@nuxt-alt/proxy` dependency to your project

```bash
yarn add @nuxt-alt/proxy
```

2. Add `@nuxt-alt/proxy` to the `modules` section of `nuxt.config.ts`

```ts
export default defineNuxtConfig({
    modules: [
        '@nuxt-alt/proxy'
    ],
    proxy: {
        /* module options */
    }
});

```

## Options

### `enableProxy`

- Type: `Boolean`
- Default: `true`

Enable/disable server side proxying via nitro.

### `proxies`

- Type: `Object`
- Default: `{}`

urls to proxy

```ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
    modules: [
        '@nuxt-alt/proxy',
    ],
    proxy: {
        proxies: {
            // string shorthand
            '/foo': 'http://localhost:4567',
            // with options
            '/api': {
                target: 'http://jsonplaceholder.typicode.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            },
            // with RegEx
            '^/fallback/.*': {
                target: 'http://jsonplaceholder.typicode.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/fallback/, '')
            },
            // Using the proxy instance
            '/api': {
                target: 'http://jsonplaceholder.typicode.com',
                changeOrigin: true,
                configure: (proxy, options) => {
                    // proxy will be an instance of 'http-proxy'
                }
            },
            // Proxying websockets or socket.io
            '/socket.io': {
                target: 'ws://localhost:5173',
                ws: true
            }
        },
        experimental: {
            importFunctions: false
        }
    }
})
```

### `experimental.importFunctions` (experimental)

- Type: `Boolean`
- Default: `false`

When enabled, proxy functions can be used as a way to overcome the issue where you can't use variables in the function due to json serializatrion issues.

Example:

```ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
    modules: [
        '@nuxt-alt/proxy',
    ],
    proxy: {
        proxies: {
            // Using the proxy instance
            '/api': {
                target: 'http://jsonplaceholder.typicode.com',
                changeOrigin: true,
                rewrite: 'exampleFunction'
            },
        },
        experimental: {
            importFunctions: true
        }
    }
})
```

and in the file inside the srcDir: `proxy/rewrite.ts`:

```ts
export default {
    exampleFunction: (path) => path.replace(/^\/api/, '')
}
```
> Proxy module for [Nuxt](https://nuxt.com)

## Info

This serves as an alternative for @nuxtjs-alt/proxy. Please note that this is for Nuxt 3 only. This module creates a file in your `buildDir` called `nuxt-proxy.ts` which will handle all of the proxying you set within your nuxt config. The config is similar to what vite has except that this one creates a physical file which is needed for production.

## Setup

1. Add `@nuxt-alt/proxy` dependency to your project

```bash
yarn add @nuxt-alt/http
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

## Changes

New options have been added to the proxy module. The proxies now need to be moved into a `proxies` property (example provided below). A `fetch` property has been added so that proxying applies to the native `$fetch` in nitro and via client side. An `enableProxy` property has been added if you would like to disable the `http-proxy` nitro plugin on the server side.

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
        }
    }
})
```

### `fetch` (experimental)

- Type: `Boolean`
- Default: `false`

This will attempt tto override ohmyfetch so that it may work with the proxy module. It may or may not work.

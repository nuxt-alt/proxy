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

### `proxies`

- Type: `Object`
- Default: `{}`
- 
### `debug`

- Type: `Boolean`
- Default: `false` (false in prod | true in dev)

urls to proxy

```ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
    modules: [
        '@nuxt-alt/proxy',
    ],
    proxy: {
        debug: false,
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
                rewrite: (path) => path.replace(/^\/fallback/, ''),
                configure: (proxy, options, runtimeConfig) => {
                    // proxy will be an instance of 'http-proxy'
                },
            },
            // Using the proxy instance
            '/api': {
                target: 'http://jsonplaceholder.typicode.com',
                changeOrigin: true,
                configureWithEvent: (proxy, options, runtimeConfig, event, h3) => {
                    // proxy will be an instance of 'http-proxy'
                    // event will be an instance of the matched url
                    proxy.on('proxyReq', (proxyReq) => {
                        const cookies = h3.parseCookies(event)
                        console.log(cookies)
                    })
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

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

### `debug`

- Type: `Boolean`
- Default: `false` (false in prod | true in dev)

urls to proxy

### `experimental.listener`

- Type: `Boolean`
- Default: `false`

Enable this to use a nitro plugin that tries to hook onto the server's request and grab the server to listen in production. (doesnt work in dev mode)
This is untested in non-node environments.

This property also affects websockets in dev mode for proxying so enable it if you want to proxy websockets in dev mode.

Nitro hook available after enabling (only in production):

```ts
nitroApp.hooks.hook('listen:node', (server) => {})
```

## Config Example

```ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
    modules: [
        '@nuxt-alt/proxy',
    ],
    proxy: {
        debug: false,
        experimental: {
            listener: false
        },
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
            // Proxying websockets or socket.io - Note this only works with `experimental.listener`
            '/socket.io': {
                target: 'ws://localhost:5173',
                ws: true
            }
        }
    }
})
```
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
    modules: [
        '../src'
    ],
    proxy: {
        debug: true,
        proxies: {
            // string shorthand
            '/foo': 'http://localhost:4567',
            // with RegEx
            '^/fallback/.*': {
                target: 'http://jsonplaceholder.typicode.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/fallback/, ''),
                configure: (proxy, options) => {
                    // proxy will be an instance of 'http-proxy'
                }
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
            listener: true
        }
    }
})

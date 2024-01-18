import { type NitroApp } from 'nitropack'
import { defineEventHandler } from 'h3'
import type { Server as HttpServer } from 'node:http'
import type { Server as SecureHttpServer } from 'node:https'
// @ts-expect-error: alias
import { useNitroApp } from '#internal/nitro'

let alreadyCalled = false

export default defineEventHandler(async event => {
    // @ts-expect-error
    const server = event.node.req.socket?.server as HttpServer | SecureHttpServer || event.node.res.socket?.server as HttpServer | SecureHttpServer

    if (server && !alreadyCalled) {
        await (useNitroApp() as NitroApp).hooks.callHook('listen:node', server)
        alreadyCalled = true
    }
})
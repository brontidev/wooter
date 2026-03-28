---
title: Hosting And Runtimes
description: Mount wooter on Deno, Bun, edge runtimes, browsers, and Node adapters.
sidebar:
    order: 2
---

wooter is a Fetch-native router. It does not ship a server implementation, so you mount `router.fetch` into whatever runtime you
use.

## Runtime Pattern

Define routes once, export the router, then mount `router.fetch` in each environment.

```ts
// router.ts
import { c, Wooter } from "@bronti/wooter"

const wooter = new Wooter()

wooter.route(c.chemin(), "GET", ({ resp }) => {
	resp(new Response("ok"))
})

export default wooter
```

## Deno

```ts
// main.ts
import wooter from "./router.ts"

Deno.serve((request) => wooter.fetch(request))
```

## Bun

```ts
// index.ts
import wooter from "./router"

Bun.serve({
	fetch(request) {
		return wooter.fetch(request)
	},
})
```

## Default Export Fetch-Handler Pattern

Many runtimes and platforms support a default export object with a `fetch` handler.

```ts
import wooter from "./router"

export default {
	fetch: wooter.fetch,
}
```

Common examples include:

- Cloudflare Workers
- Browser Service Workers (inside `fetch` event handling)
- Bun runtime entrypoints that consume fetch handlers
- Other WinterTC-style worker/edge runtimes that execute Fetch handlers

## Browser Service Worker Example

```ts
// sw.ts
import wooter from "./router"

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url)
	if (url.pathname.startsWith("/api/")) {
		event.respondWith(wooter.fetch(event.request))
	}
})
```

This pattern lets you build local APIs in-browser and call them with normal `fetch(...)`.

## Node.js Notes

Node's built-in `node:http` request/response objects are not Web `Request`/`Response` objects, so `wooter.fetch` cannot be plugged
in directly.

You have two options:

1. Write a translation layer between `node:http` and Web `Request`/`Response`.
2. Use a bridge package such as `@whatwg-node/server`.

### Node Adapter Using @whatwg-node/server

```ts
import { createServerAdapter } from "@whatwg-node/server"
import http from "node:http"
import wooter from "./router"

const adapter = createServerAdapter((request) => wooter.fetch(request))

http.createServer(adapter).listen(3000)
```

### Manual node:http translation

```ts
import http from "node:http"
import wooter from "./router"

http.createServer(async (req, res) => {
	const origin = `http://${req.headers.host ?? "localhost"}`
	const request = new Request(new URL(req.url ?? "/", origin), {
		method: req.method,
		headers: req.headers as HeadersInit,
		body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
		duplex: "half",
	} as RequestInit)

	const response = await wooter.fetch(request)

	res.statusCode = response.status
	response.headers.forEach((value, key) => res.setHeader(key, value))

	if (!response.body) return res.end()
	for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
		res.write(chunk)
	}
	res.end()
}).listen(3000)
```

For production Node usage, prefer a maintained adapter when possible.

# 🖲️ @ts-rex/wooter

[![JSR](https://jsr.io/badges/@ts-rex/wooter)](https://jsr.io/@ts-rex/wooter)
[![JSR Score](https://jsr.io/badges/@ts-rex/wooter/score)](https://jsr.io/@ts-rex/wooter)

> [!WARNING]
> wooter is WIP & beta, please do not use it for production until it reaches
> v1.0.0 **woot at your own risk!**

wooter is a simple router library written for Deno, it's inspired by Sveltekit's
router, as well as Oak and Hono.

- Promise-based reponse: Responses are returned via a seperate promise, rather
  than a return from the route function's promise. This is useful for doing
  extra after responding.
- Plug-and-play: wooter doesn't implement any server implementation directly,
  allowing you to plug it into any existing HTTP server implementations.
- Smart type-safe paths: Wooter uses [chemin](https://jsr.io/@dldc/chemin) for
  route matching, a function based pattern builder for routes.

### Deno example

```ts
import { delay } from "jsr:@std/async"
import { Wooter, c } from "./src/export/index.ts"

const wooter = Wooter.withMethods()

wooter.GET(c.chemin(), async ({ err, resp }) => {
	resp(new Response("hi"))
})

wooter.GET(c.chemin("error"), async ({ err, resp }) => {
	err("An error occured!!")
})

wooter.GET(c.chemin("with", c.pNumber("param")), async ({ err, resp, params }) => {
	resp(new Response(`hi ${params.param}`))
})

wooter.GET(c.chemin("after"), async ({ err, resp }) => {
	resp(new Response("ok!"))
	await delay(400)
	console.log("this ran after the response was sent.")
})

wooter.GET(c.chemin('websocket'), async ({ request, err, resp }) => {
    const 
})

const { fetch } = wooter
Deno.serve({ port: 3000 }, fetch.bind(wooter))
```

### Roadmap

- [x] Basic Router
- [x] Middleware
- [x] Namespaces

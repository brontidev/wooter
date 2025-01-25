# 🖲️ @ts-rex/wooter

[![JSR](https://jsr.io/badges/@ts-rex/wooter)](https://jsr.io/@ts-rex/wooter)
[![JSR Score](https://jsr.io/badges/@ts-rex/wooter/score)](https://jsr.io/@ts-rex/wooter)

> _it's wootin time_\
> \- kai, 2025

> [!WARNING]
> wooter is WIP, the main features are implemented but there are some bugs that
> may appear. I advise against using this for big influential projects until
> v1.0.0\
> **woot around and find out**

wooter is a simple router library written for Deno, it's inspired by Sveltekit's
router, as well as Oak and Hono.

- Promise-based reponse: Responses are returned via a seperate promise, rather
  than a return from the route function's promise. This is useful for doing
  extra after responding.
- Plug-and-play: wooter doesn't implement any server implementation directly.
  Instead a `fetch` method is implimented, allowing you to plug it into any
  existing HTTP server implementations.
- Smart type-safe paths: Wooter uses [chemin](https://jsr.io/@dldc/chemin) for
  route matching, a function based pattern builder for routes.

### Deno example

```ts
import { delay } from "jsr:@std/async"
import { c, Wooter } from "./src/export/index.ts"

const wooter = Wooter.withMethods()

wooter.GET(c.chemin(), async ({ err, resp }) => {
	resp(new Response("hi"))
})

wooter.GET(c.chemin("error"), async ({ err, resp }) => {
	err("An error occured!!")
})

wooter.GET(
	c.chemin("with", c.pNumber("param")),
	async ({ err, resp, params }) => {
		resp(new Response(`hi ${params.param}`))
	},
)

wooter.GET(c.chemin("after"), async ({ err, resp }) => {
	resp(new Response("ok!"))
	await delay(400)
	console.log("this ran after the response was sent.")
})

const { fetch } = wooter
Deno.serve({ port: 3000 }, fetch.bind(wooter))
```

### Roadmap

- [x] Basic Router
- [x] Middleware
- [x] Namespaces
- [x] wooter.route(path)\[VERB\]

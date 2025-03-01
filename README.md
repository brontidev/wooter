# 🖲️ @bronti/wooter

[![JSR](https://jsr.io/badges/@bronti/wooter)](https://jsr.io/@bronti/wooter)
[![JSR Score](https://jsr.io/badges/@bronti/wooter/score)](https://jsr.io/@bronti/wooter)

> _it's wootin time_\
> \- kai, 2025

> [!WARNING]
> wooter is beta & WIP, the main features are implemented but there are some
> bugs that may appear. I advise against using this for big influential projects
> until v100.0.0\
> **woot around and find out**

> [!NOTE]
> wooter uses [epoch semver](https://antfu.me/posts/epoch-semver).

wooter is a simple router library written for Deno, it's inspired by Sveltekit's
router, as well as Oak and Hono.

- 🔁 Promise-based reponse: Responses are returned via a seperate promise,
  rather than a return from the route function's promise. This is useful for
  doing extra after responding.
- 🔌 Plug-and-play: wooter doesn't implement any server implementation directly.
  Instead a `fetch` method is implemented, meaning wooter works anywhere where
  `Request` and `Response`, and `Promise.withResolvers()` are available,
  allowing you to plug it into any existing HTTP server implementations.
- 🧠 Smart type-safe paths: Wooter uses [chemin](https://jsr.io/@dldc/chemin)
  for route matching, a function based pattern builder for routes.

### Deno example

```ts
import { delay } from "jsr:@std/async"
import { c, Wooter } from "jsr:@bronti/wooter"

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

# Planned features

- [x] Get rid of `wooter.useMethods()` and `Wooter.withMethods()`
- [x] replace `wooter.addRoute()` and `wooter.route()` with a new multi-use
      function:
  - [x] `wooter.route\[METHOD]\(chemin, handler)`
  - [x] `wooter.route(METHOD, chemin, handler)`
  - [x] `wooter.route(chemin, { METHOD: handler })`
- [x] new function to apply middleware directly to a handler
  - [x] `use(middleware, handler): handler`

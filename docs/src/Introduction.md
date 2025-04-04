# 🖲️ @bronti/wooter

[![JSR](https://jsr.io/badges/@bronti/wooter)](https://jsr.io/@bronti/wooter)
[![JSR Score](https://jsr.io/badges/@bronti/wooter/score)](https://jsr.io/@bronti/wooter)

> [!WARNING]
> These docs are a work in progress, and may not be fully accurate. You can also
> check the generated [API Reference](rdr/reference.md)

> [!WARNING]
> wooter is beta & WIP, the main features are implemented but there are some
> bugs that may appear. I advise against using this for big influential projects
> until v100.0.0\
> **woot around and find out**

> [!NOTE]
> wooter uses [epoch semver](https://antfu.me/posts/epoch-semver).

**wooter** is a simple typescript router library, it's inspired by Sveltekit's
router, as well as Oak and Hono.

- **🔁 Promise-based responses**: responses are returned via a seperate promise,
  rather than a return from the route function's promise. This is useful for
  doing extra after responding.
- **🔌 Plug-and-play**: wooter doesn't implement any server implementation
  directly. Instead a `fetch` method is implemented, meaning wooter works
  anywhere where the fetch API is available, allowing you to plug it into any
  existing HTTP server implementations, or use it virtually by not adding a
  server.
- **🧠 Smart type-safe paths**: wooter uses
  [chemin](https://jsr.io/@dldc/chemin) for route matching, a function based
  pattern builder for routes.
- **🔗 Middleware**: wooter includes a middleware system that is just as
  innovative as it's routing capabilities.

## Deno Example

```ts
import { delay } from "jsr:@std/async"
import { c, Wooter } from "jsr:@bronti/wooter"

const wooter = new Wooter()

wooter.route.GET(c.chemin(), ({ err, resp }) => {
	resp(new Response("hi"))
})

wooter.GET(c.chemin("error"), ({ err, resp }) => {
	err("An error occured!!")
})

wooter.route.GET(
	c.chemin("with", c.pNumber("param")),
	({ err, resp, params }) => {
		resp(new Response(`hi ${params.param}`))
	},
)

wooter.route.GET(c.chemin("after"), async ({ err, resp }) => {
	resp(new Response("ok!"))
	await delay(400)
	console.log("this ran after the response was sent.")
})

export default wooter
```

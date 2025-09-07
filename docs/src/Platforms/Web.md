# Wooter on Web

Wooter can also work on the browser since it doesn't include http server logic. This is useful for an Single-Page app, or
Progressive Web App. In this example, we'll use a service worker to modify the `fetch` function to create a global API without
polluting the global scope.

```ts
// service-worker.js
import { c, Wooter } from "@bronti/wooter"

const wooter = new Wooter()

wooter.route.GET(
	c.chemin("add", c.pNumber("a"), c.pNumber("b")),
	async ({ resp, params: { a, b } }) => {
		resp(new Response(a + b))
	},
)

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url)
	// Every url that looks like http(s)://app/<route>
	if (url.host !== "app") return

	event.respondWith(wooter.fetch(event.request))
})
```

And you can run this with:

```ts
const response = await fetch("//app/add/1/2")
const text = await response.text() // 3
```

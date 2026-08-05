---
title: Quick Start
---

# Quick Start

Get up and running with Wooter in 5 minutes.

## 1. Create Your Router

```ts
import { c, Wooter } from "@bronti/wooter"

const app = new Wooter()
```

## 2. Add Your First Route

```ts
app.route(c.chemin(), "GET", async ({ resp }) => {
	resp(new Response("Hello, World!"))
})
```

## 3. Handle Multiple Methods

Use a method map to handle GET, POST, PUT, etc. on the same path:

```ts
app.route(c.chemin("users"), {
	GET: async ({ resp }) => {
		resp(Response.json(["User 1", "User 2"]))
	},
	POST: async ({ request, resp }) => {
		const body = await request.json()
		resp(Response.json(body), { status: 201 })
	},
})
```

## 4. Capture Route Parameters

Use chemin's parameter builders to create type-safe routes:

```ts
// String parameter
app.route(c.chemin("users", c.pString("id")), {
	GET: async ({ params, resp }) => {
		const userId = params.get("id")
		resp(Response.json({ id: userId }))
	},
})

// Number parameter
app.route(c.chemin("posts", c.pNumber("postId")), {
	GET: async ({ params, resp }) => {
		const postId = params.get("postId")
		resp(Response.json({ postId }))
	},
})
```

## 5. Add Middleware

Middleware runs before route handlers and can enrich context:

```ts
app.use(async ({ request, next }) => {
	const userId = request.headers.get("X-User-ID")
	await next({ userId })
})

// Now all routes have access to state.userId
app.route(c.chemin("profile"), "GET", async ({ state, resp }) => {
	resp(Response.json({ userId: state.userId }))
})
```

## 6. Handle JSON

Create a middleware to parse and validate JSON:

```ts
const jsonMiddleware = async ({ request, resp, forward, safeExit }) => {
	let cachedJson: unknown

	await forward({
		json: async () => {
			if (cachedJson) return cachedJson
			try {
				return cachedJson = await request.clone().json()
			} catch {
				resp(new Response("Invalid JSON", { status: 400 }))
				safeExit()
			}
		},
	})
}

app.use(jsonMiddleware)

app.route(c.chemin("posts"), "POST", async ({ state: { json }, resp }) => {
	const body = await json()
	resp(Response.json(body), { status: 201 })
})
```

## 7. Handle Errors

Catch errors in middleware to prevent route-level repetition:

```ts
const errorHandling = async ({ tryNext, resp }) => {
	const result = await tryNext()

	if (result.isErr()) {
		const error = result.unwrapErr()
		console.error(error)
		resp(new Response("Internal Server Error", { status: 500 }))
	}
}

app.use(errorHandling)
```

## 8. Export Your Router

The router has a built-in `fetch` method for standard HTTP servers:

```ts
// Deno
export default app.fetch

// Or serve directly (Deno example)
Deno.serve(app.fetch)

// Node.js example
import { createServer } from "http"
createServer((req, res) => {
	const url = `http://${req.headers.host}${req.url}`
	app.fetch(new Request(url, { method: req.method, headers: req.headers }))
		.then((response) => {
			res.writeHead(response.status, Object.fromEntries(response.headers))
			res.end(await response.text())
		})
}).listen(3000)
```

## Complete Example

```ts
import { c, Wooter } from "@bronti/wooter"

const app = new Wooter()
	.use(async ({ request, next }) => {
		await next({ timestamp: Date.now() })
	})
	.route(c.chemin(), "GET", async ({ resp }) => {
		resp(new Response("Home"))
	})
	.route(c.chemin("users", c.pString("id")), "GET", async ({ params, state, resp }) => {
		resp(Response.json({
			userId: params.get("id"),
			requestTime: state.timestamp,
		}))
	})
	.route(c.chemin("api", "users"), "POST", async ({ request, resp }) => {
		const body = await request.json()
		resp(Response.json(body), { status: 201 })
	})
	.notFound(({ resp }) => {
		resp(new Response("Not Found", { status: 404 }))
	})

export default app.fetch
```

## Next Steps

- **[Core Concepts](./core-concepts.md)** — Understand the response-first lifecycle
- **[Routing](./routing.md)** — Explore advanced routing patterns
- **[Middleware](./middleware.md)** — Learn middleware composition
- **[Examples](./examples/basic-routes.md)** — See more real-world patterns

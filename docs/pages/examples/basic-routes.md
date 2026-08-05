---
title: Basic Routing Examples
---

# Basic Routing Examples

Practical examples of common routing patterns.

## Simple GET Request

```ts
import { c, Wooter } from "@bronti/wooter"

const app = new Wooter()

app.route(c.chemin("hello"), "GET", async ({ resp }) => {
	resp(new Response("Hello, World!"))
})

export default app.fetch
```

## GET with JSON Response

```ts
app.route(c.chemin("users"), "GET", async ({ resp }) => {
	const users = [
		{ id: 1, name: "Alice" },
		{ id: 2, name: "Bob" },
	]
	resp(Response.json(users))
})
```

## GET with Route Parameters

```ts
app.route(c.chemin("users", c.pNumber("id")), "GET", async ({ params, resp }) => {
	const userId = params.get("id")
	resp(Response.json({
		id: userId,
		name: "Alice",
	}))
})
```

## POST with Request Body

```ts
app.route(c.chemin("users"), "POST", async ({ request, resp }) => {
	const body = await request.json()

	const newUser = {
		id: Math.random(),
		...body,
	}

	resp(Response.json(newUser), { status: 201 })
})
```

## Multiple Methods on Same Path

```ts
app.route(c.chemin("users"), {
	GET: async ({ resp }) => {
		resp(Response.json([]))
	},
	POST: async ({ request, resp }) => {
		const body = await request.json()
		resp(Response.json(body), { status: 201 })
	},
})
```

## CRUD Example

```ts
const users = new Map()
let nextId = 1

const app = new Wooter()
	// List all users
	.route(c.chemin("users"), {
		GET: async ({ resp }) => {
			resp(Response.json(Array.from(users.values())))
		},
		POST: async ({ request, resp }) => {
			const body = await request.json()
			const user = { id: nextId++, ...body }
			users.set(user.id, user)
			resp(Response.json(user), { status: 201 })
		},
	})
	// Get, update, delete one user
	.route(c.chemin("users", c.pNumber("id")), {
		GET: async ({ params, resp }) => {
			const id = params.get("id")
			const user = users.get(id)
			if (!user) {
				return resp(new Response("Not found", { status: 404 }))
			}
			resp(Response.json(user))
		},
		PUT: async ({ params, request, resp }) => {
			const id = params.get("id")
			const body = await request.json()
			const user = { id, ...body }
			users.set(id, user)
			resp(Response.json(user))
		},
		DELETE: async ({ params, resp }) => {
			const id = params.get("id")
			users.delete(id)
			resp(null, { status: 204 })
		},
	})

export default app.fetch
```

## Nested Paths

```ts
app
	.route(c.chemin("api", "v1", "users"), "GET", async ({ resp }) => {
		resp(Response.json([]))
	})
	.route(c.chemin("api", "v1", "posts"), "GET", async ({ resp }) => {
		resp(Response.json([]))
	})
```

## Nested Routers

```ts
const api = app.branch(c.chemin("api", "v1"))

api.route(c.chemin("users"), "GET", async ({ resp }) => {
	resp(Response.json([]))
})

api.route(c.chemin("posts"), "GET", async ({ resp }) => {
	resp(Response.json([]))
})

// Routes available as:
// GET /api/v1/users
// GET /api/v1/posts
```

## Nested Router with Parameters

```ts
const userRouter = app.branch(c.chemin("users", c.pNumber("userId")))

userRouter.route(c.chemin("profile"), "GET", async ({ params, resp }) => {
	const userId = params.get("userId")
	resp(Response.json({ userId }))
})

userRouter.route(c.chemin("settings"), "GET", async ({ params, resp }) => {
	const userId = params.get("userId")
	resp(Response.json({ userId, settings: {} }))
})

// Routes:
// GET /users/{userId}/profile
// GET /users/{userId}/settings
```

## Custom Parameter Patterns

```ts
// Hex color
const hexColor = c.p("color", /^[0-9a-f]{6}$/i)

app.route(c.chemin("colors", hexColor), "GET", async ({ params, resp }) => {
	const color = params.get("color")
	resp(Response.json({ color }))
})

// UUID
const uuid = c.p("id", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

app.route(c.chemin("items", uuid), "GET", async ({ params, resp }) => {
	const id = params.get("id")
	resp(Response.json({ id }))
})
```

## 404 Handler

```ts
app.notFound(async ({ request, resp }) => {
	resp(
		new Response(
			`Not found: ${request.method} ${request.url}`,
			{ status: 404 },
		),
	)
})
```

## Status Codes

```ts
// 200 OK (default)
resp(Response.json({ data: "ok" }))

// 201 Created
resp(Response.json(data), { status: 201 })

// 204 No Content
resp(null, { status: 204 })

// 400 Bad Request
resp(new Response("Bad request", { status: 400 }))

// 401 Unauthorized
resp(new Response("Unauthorized", { status: 401 }))

// 403 Forbidden
resp(new Response("Forbidden", { status: 403 }))

// 404 Not Found
resp(new Response("Not found", { status: 404 }))

// 500 Server Error
resp(new Response("Server error", { status: 500 }))
```

## Response Headers

```ts
resp(Response.json(data), {
	headers: {
		"X-Custom-Header": "value",
		"Content-Type": "application/json",
	},
})
```

## Redirects

```ts
import { makeRedirect } from "@bronti/wooter"

app.route(c.chemin("old-url"), "GET", async ({ resp }) => {
	resp(makeRedirect("/new-url", { status: 301 }))
})
```

## Static Files (Via Redirect)

```ts
app.route(c.chemin("docs"), "GET", async ({ resp }) => {
	resp(makeRedirect("https://example.com/docs"))
})
```

## Query Parameters

```ts
app.route(c.chemin("search"), "GET", async ({ request, resp }) => {
	const url = new URL(request.url)
	const q = url.searchParams.get("q")
	const limit = url.searchParams.get("limit") || "10"

	const results = search(q, parseInt(limit))
	resp(Response.json(results))
})

// GET /search?q=alice&limit=20
```

## Request Headers

```ts
app.route(c.chemin("protected"), "GET", async ({ request, resp }) => {
	const token = request.headers.get("Authorization")
	const userAgent = request.headers.get("User-Agent")

	if (!token) {
		return resp(new Response("Unauthorized", { status: 401 }))
	}

	resp(Response.json({ token, userAgent }))
})
```

## Request Method Checking

```ts
app.route(c.chemin("either"), "*", async ({ request, resp }) => {
	if (request.method === "GET") {
		resp(Response.json({ method: "GET" }))
	} else if (request.method === "POST") {
		resp(Response.json({ method: "POST" }))
	} else {
		resp(new Response("Method not allowed", { status: 405 }))
	}
})
```

## Next Steps

- **[Middleware Patterns](./middleware-patterns.md)** — Middleware examples
- **[Error Handling](./error-handling.md)** — Error handling patterns
- **[Real-World Example](./real-world.md)** — Complete CRUD API

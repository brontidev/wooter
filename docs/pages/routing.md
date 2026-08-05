---
title: Routing
---

# Routing

Wooter uses [Chemin](https://jsr.io/@dldc/chemin) for type-safe path routing.

## Basic Routes

Register a route for a specific HTTP method:

```ts
import { c, Wooter } from "@bronti/wooter"

const app = new Wooter()

// Single method
app.route(c.chemin("users"), "GET", async ({ resp }) => {
	resp(Response.json(["User 1", "User 2"]))
})
```

## Multiple Methods

Pass an array of methods, or use a method map for readability:

### Array of Methods

```ts
app.route(c.chemin("posts"), ["GET", "POST"], async ({ request, resp }) => {
	if (request.method === "GET") {
		resp(Response.json([]))
	} else {
		resp(Response.json({}), { status: 201 })
	}
})
```

### Method Map (Recommended)

```ts
app.route(c.chemin("posts"), {
	GET: async ({ resp }) => {
		resp(Response.json([]))
	},
	POST: async ({ request, resp }) => {
		const body = await request.json()
		resp(Response.json(body), { status: 201 })
	},
})
```

### Wildcard Methods

Handle all HTTP methods with `"*"`:

```ts
app.route(c.chemin("any"), "*", async ({ request, resp }) => {
	resp(Response.json({ method: request.method }))
})
```

## Path Parameters

Use Chemin's parameter builders to capture dynamic segments:

### String Parameters

```ts
import { c } from "@bronti/wooter"

app.route(c.chemin("users", c.pString("id")), "GET", async ({ params, resp }) => {
	const id = params.get("id")
	resp(Response.json({ id }))
})
```

Access captured value with `params.get("id")`.

### Number Parameters

```ts
app.route(c.chemin("posts", c.pNumber("postId")), "GET", async ({ params, resp }) => {
	const postId = params.get("postId") // Already validated as number
	resp(Response.json({ postId }))
})
```

### Custom Patterns

Use Chemin's pattern builder for custom validation:

```ts
import { c } from "@bronti/wooter"

// Hex color code
const hexColor = c.p("color", /^[0-9a-f]{6}$/i)

app.route(c.chemin("colors", hexColor), "GET", async ({ params, resp }) => {
	const color = params.get("color")
	resp(Response.json({ color }))
})
```

For more pattern options, see [Chemin documentation](https://jsr.io/@dldc/chemin).

## Nested Paths

Combine multiple segments:

```ts
app.route(
	c.chemin("api", "v1", "users", c.pNumber("id"), "posts"),
	"GET",
	async ({ params, resp }) => {
		resp(Response.json({ userId: params.get("id") }))
	},
)
```

## Nested Routers

Use `branch()` to create child routers with scoped paths:

```ts
const api = app.branch(c.chemin("api"))

api.route(c.chemin("users"), "GET", async ({ resp }) => {
	resp(Response.json(["Alice", "Bob"]))
})

api.route(c.chemin("posts"), "GET", async ({ resp }) => {
	resp(Response.json([]))
})

// Routes are registered as:
// GET /api/users
// GET /api/posts
```

### Nested Router with Parameters

```ts
const userRouter = app.branch(c.chemin("users", c.pString("userId")))

userRouter.route(c.chemin("profile"), "GET", async ({ params, resp }) => {
	const userId = params.get("userId")
	resp(Response.json({ userId }))
})

// Route: GET /users/{userId}/profile
```

### Middleware on Nested Routers

Apply middleware to a branch that doesn't affect the parent:

```ts
const app = new Wooter()
	.use(globalAuth)

const adminRouter = app.branch(c.chemin("admin"))
	.use(requireAdminRole)
	.route(c.chemin(), "GET", ({ resp }) => {
		resp(Response.json({ admin: true }))
	})

// globalAuth runs for all routes
// requireAdminRole only runs for /admin routes
```

## Root Routes

Use empty path to handle the root:

```ts
app.route(c.chemin(), "GET", async ({ resp }) => {
	resp(new Response("Home"))
})
```

## Route Chaining

Routes return `this` for chaining:

```ts
app
	.route(c.chemin(), "GET", ({ resp }) => resp(new Response("Home")))
	.route(c.chemin("about"), "GET", ({ resp }) => resp(new Response("About")))
	.route(c.chemin("contact"), "GET", ({ resp }) => resp(new Response("Contact")))
```

## 404 Handler

Register a fallback for unmatched routes:

```ts
app.notFound(async ({ request, resp }) => {
	resp(new Response(`Not found: ${request.method} ${request.url}`, { status: 404 }))
})
```

## Exported Functions

Each route exports a `fetch` handler compatible with standard HTTP servers:

```ts
// Deno
export default app.fetch

// Node.js/Express style
const handler = app.fetch

// Use with any Fetch API compatible server
```

## Parameter Type Inference

TypeScript automatically infers parameter types from your route definition:

```ts
app.route(c.chemin("users", c.pNumber("id")), "GET", async ({ params, resp }) => {
	// TypeScript knows params includes 'id' of type number
	const id = params.get("id") // type: number
	resp(Response.json({ id }))
})

// This would error at compile time:
app.route(c.chemin("posts", c.pString("slug")), "GET", async ({ params }) => {
	params.get("id") // Error: 'id' doesn't exist, only 'slug'
})
```

## Viewing Routes

The router doesn't provide introspection APIs, but you can derive routes from your route definitions:

```ts
const routes = [
	{ path: "GET /", handler: "home" },
	{ path: "GET /users", handler: "list users" },
	{ path: "GET /users/:id", handler: "get user" },
]
```

## Common Patterns

### RESTful API

```ts
const app = new Wooter()
	.route(c.chemin("items"), {
		GET: async ({ resp }) => resp(Response.json([])),
		POST: async ({ request, resp }) => {
			const item = await request.json()
			resp(Response.json(item), { status: 201 })
		},
	})
	.route(c.chemin("items", c.pNumber("id")), {
		GET: async ({ params, resp }) => {
			resp(Response.json({ id: params.get("id") }))
		},
		PUT: async ({ params, request, resp }) => {
			const item = await request.json()
			resp(Response.json(item))
		},
		DELETE: async ({ params, resp }) => {
			resp(null, { status: 204 })
		},
	})
```

### API Versioning

```ts
const v1 = app.branch(c.chemin("api", "v1"))
const v2 = app.branch(c.chemin("api", "v2"))

v1.route(c.chemin("users"), "GET", ({ resp }) => {
	resp(Response.json({ version: 1 }))
})

v2.route(c.chemin("users"), "GET", ({ resp }) => {
	resp(Response.json({ version: 2 }))
})
```

### Middleware per Route

Use `branch()` to apply middleware to a subset of routes:

```ts
const publicRoutes = app.branch(c.chemin("public"))

const privateRoutes = app
	.branch(c.chemin("private"))
	.use(requireAuth)

publicRoutes.route(c.chemin("info"), "GET", ({ resp }) => {
	resp(Response.json({}))
})

privateRoutes.route(c.chemin("profile"), "GET", ({ state: { user }, resp }) => {
	resp(Response.json(user))
})
```

## Next Steps

- **[Middleware](./middleware.md)** — Compose middleware chains
- **[Control Flow](./control-flow.md)** — Understanding next() and forward()
- **[Examples](./examples/basic-routes.md)** — See real route patterns

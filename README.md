# @bronti/wooter

[![JSR](https://jsr.io/badges/@bronti/wooter)](https://jsr.io/@bronti/wooter)
[![JSR Score](https://jsr.io/badges/@bronti/wooter/score)](https://jsr.io/@bronti/wooter)

A **fetch-native, type-safe HTTP router** for JavaScript/TypeScript with **explicit middleware composition** and **zero runtime
dependencies**.

```ts
import { c, Wooter } from "@bronti/wooter"

const app = new Wooter()
	.use(cors)
	.use(auth)
	.route(c.chemin("users", c.pNumber("id")), "GET", async ({ params, resp }) => {
		resp(Response.json({ userId: params.get("id") }))
	})

export default app.fetch
```

## Philosophy

Wooter is built on a single principle: **every request must produce a response before the lifecycle completes.**

This invariant ensures predictable behavior. Combined with explicit middleware composition, it makes data flow visible and error
handling straightforward.

**Learn more:** [Wooter Philosophy](./PHILOSOPHY.MD)

## Key Features

- ✅ **Type-Safe by Default** — Full TypeScript inference for routes, middleware, and parameters
- ✅ **Fetch-Native** — Works with Deno, Node.js, Bun, Cloudflare Workers, and any Fetch API runtime
- ✅ **Explicit Design** — No hidden behavior; response propagation is clear and intentional
- ✅ **Composable Middleware** — State accumulates through middleware chains with type preservation
- ✅ **Lightweight** — Zero runtime dependencies; ~5KB gzipped
- ✅ **Flexible Error Handling** — Use exceptions, Result types, or custom patterns
- ✅ **Zero Magic** — Understand exactly what your code does

## Quick Start

### Installation

```bash
# Deno
deno add @bronti/wooter

# or via jsr
npx jsr add @bronti/wooter
```

### Your First Router

```ts
import { c, Wooter } from "@bronti/wooter"

const app = new Wooter()

// GET /hello
app.route(c.chemin("hello"), "GET", ({ resp }) => {
	resp(new Response("Hello, Wooter!"))
})

// GET /users/{id}
app.route(c.chemin("users", c.pNumber("id")), "GET", ({ params, resp }) => {
	resp(Response.json({ id: params.get("id") }))
})

// POST /users
app.route(c.chemin("users"), "POST", ({ request, resp }) => {
	resp(new Response("Created", { status: 201 }))
})

export default app.fetch
```

### Run with Deno

```bash
deno serve app.ts
```

## Core Concepts

### Response-First Lifecycle

Every request must produce a response. This is Wooter's core guarantee.

```ts
app.route(c.chemin("example"), "GET", ({ resp }) => {
	// ✅ This works
	resp(new Response("OK"))

	// ❌ Forgetting resp() throws HandlerDidntRespondError
})
```

### Middleware Composition

Middleware accumulates state for downstream handlers:

```ts
const app = new Wooter()
	.use(async ({ next }) => {
		// Add user to state
		await next({ user: { id: 1, name: "Alice" } })
	})
	.use(async ({ state: { user }, next }) => {
		// Access user from previous middleware
		await next({
			permissions: getPermissions(user),
		})
	})
	.route(c.chemin("admin"), "GET", async ({ state, resp }) => {
		// Access all accumulated state
		resp(Response.json({ user: state.user, perms: state.permissions }))
	})
```

### Explicit Response Propagation

Middleware chooses how to handle responses:

```ts
// forward() — Pass through without modification
await forward({ userId: 123 })

// next() — Inspect or modify response
const response = await next({ userId: 123 })
resp(modifyHeaders(response))

// tryNext() — Capture errors as Result
const result = await tryNext()
result.match(
	(response) => resp(response),
	(error) => resp(new Response("Error", { status: 500 })),
)
```

## Core Topics

- **[Getting Started](./docs/pages/quick-start.md)** — 5-minute setup
- **[Installation](./docs/pages/installation.md)** — JSR, npm, Bun, esm.sh
- **[Core Concepts](./docs/pages/core-concepts.md)** — Response-first lifecycle
- **[Routing](./docs/pages/routing.md)** — Type-safe paths and parameters
- **[Middleware](./docs/pages/middleware.md)** — Building middleware chains
- **[Control Flow](./docs/pages/control-flow.md)** — next(), forward(), tryNext()
- **[API Reference](./docs/pages/api-reference.md)** — Complete API documentation
- **[Examples](./docs/pages/examples/basic-routes.md)** — Practical code examples
- **[FAQ](./docs/pages/faq.md)** — Common questions

## Examples

### CRUD API

```ts
import { c, middleware, Wooter } from "@bronti/wooter"

const db = new Map()

const app = new Wooter()
	.route(c.chemin("items"), {
		GET: async ({ resp }) => {
			resp(Response.json(Array.from(db.values())))
		},
		POST: async ({ request, resp }) => {
			const item = await request.json()
			db.set(item.id, item)
			resp(Response.json(item), { status: 201 })
		},
	})
	.route(c.chemin("items", c.pNumber("id")), {
		GET: async ({ params, resp }) => {
			const item = db.get(params.get("id"))
			resp(item ? Response.json(item) : new Response("Not found", { status: 404 }))
		},
		PUT: async ({ params, request, resp }) => {
			const item = await request.json()
			db.set(params.get("id"), item)
			resp(Response.json(item))
		},
		DELETE: async ({ params, resp }) => {
			db.delete(params.get("id"))
			resp(null, { status: 204 })
		},
	})

export default app.fetch
```

### Middleware

```ts
// Authentication
const auth = middleware<{ user: User }>(
	async ({ request, next, resp }) => {
		const token = request.headers.get("Authorization")
		if (!token) return resp(new Response("Unauthorized", { status: 401 }))

		const user = verifyToken(token)
		await next({ user })
	},
)

// JSON parsing
const json = middleware<{ json: () => Promise<any> }>(
	async ({ request, forward, resp, safeExit }) => {
		let cached: any
		await forward({
			json: async () => {
				if (cached) return cached
				try {
					return cached = await request.json()
				} catch {
					resp(new Response("Invalid JSON", { status: 400 }))
					safeExit()
				}
			},
		})
	},
)

const app = new Wooter()
	.use(json)
	.use(auth)
	.route(c.chemin("users"), "POST", async ({ state: { json }, resp }) => {
		const body = await json()
		resp(Response.json(body), { status: 201 })
	})
```

## Runtimes

Wooter works with any Fetch API-compatible runtime:

| Runtime            | Version | Status                           |
| ------------------ | ------- | -------------------------------- |
| Deno               | 1.20+   | ✅ Fully supported               |
| Node.js            | 18+     | ✅ Fully supported               |
| Bun                | 0.1.0+  | ✅ Fully supported               |
| Cloudflare Workers | Any     | ✅ Fully supported               |
| Deno Deploy        | Any     | ✅ Fully supported               |
| Fastly Compute     | Any     | ✅ Fully supported               |
| Modern Browsers    | -       | ✅ Supported (limited use cases) |

## Status

Wooter follows **[epoch semver](https://antfu.me/posts/epoch-semver)**. The core API is stable, but the library hasn't reached
v100 yet. Consider it production-ready for non-critical applications.

| Aspect         | Status                        |
| -------------- | ----------------------------- |
| Core Routing   | ✅ Stable                     |
| Middleware     | ✅ Stable                     |
| API Surface    | ✅ Stable                     |
| Public Release | In progress (aiming for v100) |

## Contributing

Contributions are welcome! Areas for improvement:

- Documentation and examples
- Performance optimizations
- Bug reports and fixes
- Feature ideas (with discussion first)
- Community middleware

## License

MIT

## Learn More

- **[Full Documentation](./docs/pages/index.md)** — Complete guides and references
- **[PHILOSOPHY.MD](./PHILOSOPHY.MD)** — Design principles and rationale
- **[Examples Directory](./examples/)** — Real-world code examples
- **[JSR Package](https://jsr.io/@bronti/wooter)** — Package details and usage
- **[Chemin Router](https://jsr.io/@dldc/chemin)** — Path matching library

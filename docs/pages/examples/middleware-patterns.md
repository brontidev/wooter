---
title: Middleware Patterns
---

# Middleware Patterns

Real-world middleware examples from the Wooter codebase and common patterns.

> **Tip:** RouteContext provides `ctx.json()` as a convenient shorthand. Instead of `ctx.resp(Response.json(data))`, you can use
> `ctx.json(data)`. This is available in both route handlers and middleware context.

## JSON Parsing

```ts
import { makeError, middleware } from "@bronti/wooter"

const json = middleware<{ json: () => Promise<any> }>(
	async ({ request, resp, forward, safeExit }) => {
		let _json: any

		await forward({
			json: async () => {
				if (_json) return _json
				try {
					return _json = await request.clone().json()
				} catch (e) {
					resp(makeError(400, "Invalid JSON"))
					safeExit()
				}
			},
		})
	},
)

export default json
```

## Cookie Handling

```ts
import { middleware } from "@bronti/wooter"
import { parse, serialize, type SerializeOptions } from "npm:cookie"

const cookies = middleware<{
	cookies: {
		get(name: string): string | undefined
		set(name: string, value: string, options?: Partial<SerializeOptions>): void
		delete(name: string): void
	}
}>(async ({ request, next, resp }) => {
	const cookieHeader = request.headers.get("cookie") || ""
	const parsed = parse(cookieHeader)
	const updates = new Map<string, { value: string; opts?: Partial<SerializeOptions> }>()

	const cookies = {
		get: (name: string) => updates.get(name)?.value ?? parsed[name],
		set: (name: string, value: string, opts?: Partial<SerializeOptions>) => {
			updates.set(name, { value, opts })
		},
		delete: (name: string) => {
			updates.set(name, { value: "", opts: { maxAge: 0 } })
		},
	}

	const response = await next({ cookies })

	for (const [name, { value, opts }] of updates.entries()) {
		response.headers.append("Set-Cookie", serialize(name, value, opts))
	}

	resp(response)
})

export default cookies
```

## Authentication

```ts
import { middleware, WooterError } from "@bronti/wooter"

interface User {
	id: string
	email: string
}

const auth = middleware<{ user: User }>(
	async ({ request, resp, forward }) => {
		const token = request.headers.get("Authorization")?.split(" ")[1]

		if (!token) {
			resp(new Response("Unauthorized", { status: 401 }))
			return
		}

		try {
			const user = verifyJWT(token)
			await forward({ user })
		} catch (error) {
			resp(new Response("Invalid token", { status: 403 }))
		}
	},
)

function verifyJWT(token: string): User {
	// Implementation would decode and verify token
	return { id: "123", email: "user@example.com" }
}

export default auth
```

## Rate Limiting

```ts
import { middleware } from "@bronti/wooter"

const limits = new Map<string, { count: number; reset: number }>()
const MAX_REQUESTS = 100
const WINDOW_MS = 60 * 1000

const rateLimiting = middleware(async ({ request, resp, forward }) => {
	const ip = request.headers.get("X-Forwarded-For") || "unknown"
	const now = Date.now()

	let limit = limits.get(ip)

	if (!limit || now > limit.reset) {
		limit = { count: 0, reset: now + WINDOW_MS }
		limits.set(ip, limit)
	}

	if (limit.count >= MAX_REQUESTS) {
		resp(new Response("Too Many Requests", { status: 429 }))
		return
	}

	limit.count++
	await forward()
})

export default rateLimiting
```

## Logging

```ts
import { middleware } from "@bronti/wooter"

const logging = middleware(async ({ request, next, resp }) => {
	const start = Date.now()
	const response = await next()
	const duration = Date.now() - start

	console.log(
		`${request.method} ${new URL(request.url).pathname} ` +
			`${response.status} ${duration}ms`,
	)

	resp(response)
})

export default logging
```

## Error Handling

```ts
import { middleware } from "@bronti/wooter"

const errorHandler = middleware(async ({ tryNext, resp }) => {
	const result = await tryNext()

	result.match(
		(response) => resp(response),
		(error) => {
			console.error("Request error:", error)

			if (error instanceof ValidationError) {
				resp(new Response(error.message, { status: 400 }))
			} else if (error instanceof NotFoundError) {
				resp(new Response(error.message, { status: 404 }))
			} else {
				resp(new Response("Internal Server Error", { status: 500 }))
			}
		},
	)
})

class ValidationError extends Error {}
class NotFoundError extends Error {}

export default errorHandler
```

## CORS Middleware

```ts
import { middleware } from "@bronti/wooter"

const cors = middleware(async ({ request, next, resp }) => {
	const origin = request.headers.get("Origin")
	const response = await next()

	if (origin) {
		response.headers.set("Access-Control-Allow-Origin", origin)
		response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		response.headers.set("Access-Control-Allow-Headers", "Content-Type")
	}

	resp(response)
})
	// Handle OPTIONS requests
	.route(c.chemin(), "OPTIONS", ({ resp }) => {
		resp(new Response(null, { status: 204 }))
	})

export default cors
```

## Request Validation

```ts
import { middleware } from "@bronti/wooter"
import { z } from "npm:zod"

const withValidation = (schema: z.ZodSchema) =>
	middleware<{ validatedBody: any }>(
		async ({ request, resp, forward, safeExit }) => {
			try {
				const body = await request.json()
				const validated = schema.parse(body)
				await forward({ validatedBody: validated })
			} catch (error) {
				const issues = error.issues?.map((i: any) => `${i.path.join(".")}: ${i.message}`)
				resp(new Response(issues?.join("\n"), { status: 400 }))
				safeExit()
			}
		},
	)

const userSchema = z.object({
	name: z.string(),
	email: z.string().email(),
})

export default withValidation(userSchema)
```

## Authorization Middleware

```ts
import { middleware } from "@bronti/wooter"

const requireRole = (role: string) =>
	middleware(async ({ state: { user }, resp, forward }) => {
		if (!user.roles?.includes(role)) {
			resp(new Response("Forbidden", { status: 403 }))
			return
		}

		await forward()
	})

const requirePermission = (permission: string) =>
	middleware(async ({ state: { user }, resp, forward }) => {
		if (!user.permissions?.includes(permission)) {
			resp(new Response("Forbidden", { status: 403 }))
			return
		}

		await forward()
	})

// Usage
const admin = app
	.branch(c.chemin("admin"))
	.use(auth)
	.use(requireRole("admin"))
```

## Caching Middleware

```ts
import { middleware } from "@bronti/wooter"

const cache = new Map<string, { body: string; headers: Headers; time: number }>()
const CACHE_TTL = 60 * 1000

const caching = middleware(async ({ request, next, resp }) => {
	if (request.method !== "GET") {
		const response = await next()
		resp(response)
		return
	}

	const key = request.url
	const cached = cache.get(key)

	if (cached && Date.now() - cached.time < CACHE_TTL) {
		resp(
			new Response(cached.body, {
				headers: cached.headers,
			}),
		)
		return
	}

	const response = await next()

	if (response.status === 200) {
		const body = await response.text()
		cache.set(key, {
			body,
			headers: response.headers,
			time: Date.now(),
		})
		resp(new Response(body, { headers: response.headers }))
	} else {
		resp(response)
	}
})

export default caching
```

## Request Timing

```ts
import { middleware } from "@bronti/wooter"

const timing = middleware<{ timer: () => number }>(
	async ({ next }) => {
		const startTime = performance.now()

		await next({
			timer: () => performance.now() - startTime,
		})
	},
)

// Usage in route
app
	.use(timing)
	.route(c.chemin("example"), "GET", async ({ state, resp }) => {
		const elapsed = state.timer()
		resp(Response.json({ elapsedMs: elapsed }))
	})
```

## Conditional Middleware

```ts
// Only enable in development
if (Deno.env.get("ENV") === "development") {
	app.use(logging)
}

// Only on specific routes
const publicRoutes = app.branch(c.chemin("public"))
const privateRoutes = app
	.branch(c.chemin("private"))
	.use(requireAuth)
```

## Middleware Composition

```ts
import { use } from "@bronti/wooter"

const m1 = middleware<{ value: string }>(async ({ next }) => {
	await next({ value: "from m1" })
})

const m2 = middleware(async ({ state, next }) => {
	console.log(state.value)
	await next()
})

const handler = ({ state, resp }) => {
	resp(Response.json(state))
}

const composed = use(m1, use(m2, handler))

app.route(c.chemin("test"), "GET", composed)
```

## Next Steps

- **[Error Handling Examples](./error-handling.md)** — Error patterns
- **[Real-World Example](./real-world.md)** — Complete CRUD API
- **[Middleware Guide](../middleware.md)** — Middleware concepts

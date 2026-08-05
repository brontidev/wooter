---
title: Error Handling Examples
---

# Error Handling Examples

Wooter supports both exception-based and functional error handling. Both patterns are valid.

## Try/Catch Pattern

Using traditional try/catch for error handling:

```ts
app.route(c.chemin("users"), "POST", async ({ request, resp }) => {
	try {
		const body = await request.json()

		if (!body.email) {
			return resp(new Response("Email required", { status: 400 }))
		}

		const user = await db.createUser(body)
		resp(Response.json(user), { status: 201 })
	} catch (error) {
		console.error(error)
		resp(new Response("Server error", { status: 500 }))
	}
})
```

## Result Type Pattern

Using `Result<T, E>` from `@bronti/robust`:

```ts
import { err, ok, Result } from "@bronti/wooter"

app.route(c.chemin("users"), "POST", async ({ request, resp }) => {
	const result = await parseAndCreateUser(request)

	const response = result.match(
		(user) => Response.json(user, { status: 201 }),
		(error) => new Response(error.message, { status: error.status }),
	)

	resp(response)
})

async function parseAndCreateUser(request: Request): Promise<Result<User, ApiError>> {
	try {
		const body = await request.json()

		if (!body.email) {
			return err(new ApiError("Email required", 400))
		}

		const user = await db.createUser(body)
		return ok(user)
	} catch (error) {
		return err(new ApiError("Server error", 500))
	}
}

class ApiError extends Error {
	constructor(message: string, public status: number) {
		super(message)
	}
}
```

## Middleware Error Handling

Handle errors in middleware to avoid repetition:

```ts
import { middleware } from "@bronti/wooter"

// JSON parsing middleware with error handling
const json = middleware<{ json: () => Promise<any> }>(
	async ({ request, resp, forward, safeExit }) => {
		let cached: any

		await forward({
			json: async () => {
				if (cached) return cached
				try {
					return cached = await request.clone().json()
				} catch (error) {
					resp(new Response("Invalid JSON", { status: 400 }))
					safeExit()
				}
			},
		})
	},
)

// Global error handler
const errorHandler = middleware(async ({ tryNext, resp }) => {
	const result = await tryNext()

	result.match(
		(response) => resp(response),
		(error) => {
			if (error instanceof ValidationError) {
				resp(new Response(error.message, { status: 400 }))
			} else if (error instanceof NotFoundError) {
				resp(new Response(error.message, { status: 404 }))
			} else if (error instanceof AuthError) {
				resp(new Response(error.message, { status: 401 }))
			} else {
				console.error(error)
				resp(new Response("Internal Server Error", { status: 500 }))
			}
		},
	)
})

const app = new Wooter()
	.use(errorHandler)
	.use(json)
```

## Custom Error Types

Define custom error types for different scenarios:

```ts
class ValidationError extends Error {
	constructor(public fields: Record<string, string>) {
		super("Validation failed")
		this.name = "ValidationError"
	}
}

class AuthenticationError extends Error {
	constructor(message = "Authentication required") {
		super(message)
		this.name = "AuthenticationError"
	}
}

class NotFoundError extends Error {
	constructor(public resource: string) {
		super(`${resource} not found`)
		this.name = "NotFoundError"
	}
}

class DatabaseError extends Error {
	constructor(public originalError: Error) {
		super("Database operation failed")
		this.name = "DatabaseError"
	}
}
```

## Validation with Error Collection

```ts
app.route(c.chemin("users"), "POST", async ({ request, resp }) => {
	const body = await request.json()
	const errors: Record<string, string> = {}

	if (!body.name) errors.name = "Name required"
	if (!body.email) errors.email = "Email required"
	if (!body.email?.includes("@")) errors.email = "Invalid email"

	if (Object.keys(errors).length > 0) {
		return resp(Response.json({ errors }, { status: 400 }))
	}

	const user = await db.createUser(body)
	resp(Response.json(user), { status: 201 })
})
```

## Try/Catch with Result Conversion

Hybrid approach—wrap try/catch results in Result types:

```ts
import { err, ok, Result } from "@bronti/wooter"

async function safeOperation<T>(
	fn: () => Promise<T>,
): Promise<Result<T, Error>> {
	try {
		const result = await fn()
		return ok(result)
	} catch (error) {
		return err(error instanceof Error ? error : new Error(String(error)))
	}
}

app.route(c.chemin("data"), "GET", async ({ resp }) => {
	const result = await safeOperation(() => fetchData())

	const response = result.match(
		(data) => Response.json(data),
		(error) => new Response(error.message, { status: 500 }),
	)

	resp(response)
})
```

## Error Status Mapping

```ts
interface ApiError {
	message: string
	status: number
}

const errorMiddleware = middleware(async ({ tryNext, resp }) => {
	const result = await tryNext()

	result.match(
		(response) => resp(response),
		(error) => {
			const apiError = mapError(error)
			resp(new Response(apiError.message, { status: apiError.status }))
		},
	)
})

function mapError(error: unknown): ApiError {
	if (error instanceof ValidationError) {
		return { message: error.message, status: 400 }
	}
	if (error instanceof AuthenticationError) {
		return { message: error.message, status: 401 }
	}
	if (error instanceof NotFoundError) {
		return { message: error.message, status: 404 }
	}
	if (error instanceof DatabaseError) {
		console.error("DB error:", error.originalError)
		return { message: "Database error", status: 500 }
	}

	console.error("Unexpected error:", error)
	return { message: "Internal server error", status: 500 }
}
```

## Option-Based Error Handling

Using `Option` to handle missing values:

```ts
import { Option } from "@bronti/wooter"

app.route(c.chemin("posts", c.pNumber("id")), "GET", async ({ params, resp }) => {
	const postId = params.get("id")

	const post = Option.from(await getPost(postId))
		.match(
			(post) => Response.json(post),
			() => new Response("Post not found", { status: 404 }),
		)

	resp(post)
})
```

## Chained Validation with Results

```ts
import { err, ok, Result } from "@bronti/wooter"

app.route(c.chemin("users"), "POST", async ({ request, resp }) => {
	const result = await validateUser(request)
		.then((r) => r.flatMap((user) => createUser(user)))

	const response = result.match(
		(user) => Response.json(user, { status: 201 }),
		(error) => new Response(error.message, { status: error.status }),
	)

	resp(response)
})

async function validateUser(request: Request): Promise<Result<any, ApiError>> {
	try {
		const body = await request.json()
		if (!body.email) return err(new ApiError("Email required", 400))
		return ok(body)
	} catch {
		return err(new ApiError("Invalid JSON", 400))
	}
}

async function createUser(user: any): Promise<Result<User, ApiError>> {
	try {
		const created = await db.users.create(user)
		return ok(created)
	} catch (error) {
		return err(new ApiError("Failed to create user", 500))
	}
}
```

## Stray Error Handling

Handle errors that occur after response is sent:

```ts
const app = new Wooter(undefined, (error) => {
	if (error !== ControlFlowBreak) {
		console.error("Stray error after response:", error)
		// Could log to error tracking service
	}
})

app.route(c.chemin("example"), "GET", async ({ resp }) => {
	resp(new Response("OK"))

	// This error occurs after response already sent
	setTimeout(() => {
		throw new Error("Async error")
	}, 100)
})
```

## Best Practices

### ✅ Do:

```ts
// Handle errors in middleware
const errorHandler = middleware(async ({ tryNext, resp }) => {
	const result = await tryNext()
	result.match(
		(r) => resp(r),
		(e) => resp(new Response("Error", { status: 500 })),
	)
})

// Use specific error types
class ValidationError extends Error {}

// Return early with error responses
if (!isValid) {
	return resp(new Response("Invalid", { status: 400 }))
}
```

### ❌ Don't:

```ts
// Don't repeat error handling in every route
app.route(c.chemin("a"), "GET", async ({ resp }) => {
	try {
		/* ... */
	} catch { /* ... */ }
})
app.route(c.chemin("b"), "GET", async ({ resp }) => {
	try {
		/* ... */
	} catch { /* ... */ }
})

// Don't forget to respond after sending one
if (error) {
	resp(error)
	// Missing return causes "responded twice" error
	await something()
	resp(ok)
}

// Don't mix response and throw
if (error) {
	resp(Response.error())
}
throw error // But also throw
```

## Next Steps

- **[Control Flow](../control-flow.md)** — Understanding error handling with tryNext()
- **[Middleware Patterns](./middleware-patterns.md)** — More patterns
- **[Real-World Example](./real-world.md)** — Complete working example

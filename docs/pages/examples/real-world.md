---
title: Real-World Example - CRUD API with Cookies
---

# Real-World Example

A complete CRUD API with authentication and persistence using Deno KV and cookies.

## Overview

This example implements a book management API with:

- Cookie-based session tracking
- JSON request/response parsing
- Request validation with Zod
- Proper HTTP status codes
- Error handling in middleware

## Full Implementation

```ts
import { c, makeError, makeRedirect, middleware, Option, Wooter } from "@bronti/wooter"
import { z } from "npm:zod"
import { parse, serialize } from "npm:cookie"

// ============= Database Setup =============

const kv = await Deno.openKv()

const bookSchema = z.object({
	title: z.string().min(1),
	author: z.string().min(1),
	isbn: z.string().regex(/^\d{10}(\d{3})?$/),
})

type Book = z.infer<typeof bookSchema>

// ============= Middleware =============

// Cookie middleware
const cookies = middleware<{
	cookies: {
		get(name: string): string | undefined
		set(name: string, value: string): void
	}
}>(async ({ request, next, resp }) => {
	const header = request.headers.get("cookie") || ""
	const parsed = parse(header)
	const updates: Record<string, string> = {}

	const cookies = {
		get: (name: string) => updates[name] ?? parsed[name],
		set: (name: string, value: string) => {
			updates[name] = value
		},
	}

	const response = await next({ cookies })

	for (const [name, value] of Object.entries(updates)) {
		response.headers.append("Set-Cookie", serialize(name, value))
	}

	resp(response)
})

// JSON parsing middleware
const json = middleware<{
	json: () => Promise<any>
}>(async ({ request, resp, forward, safeExit }) => {
	let cached: any

	await forward({
		json: async () => {
			if (cached) return cached
			try {
				return cached = await request.clone().json()
			} catch {
				resp(makeError(400, "Invalid JSON"))
				safeExit()
			}
		},
	})
})

// Validation middleware
const withValidation = (schema: z.ZodSchema) =>
	middleware<{ validatedBody: any }>(
		async ({ state: { json }, resp, forward, safeExit }) => {
			try {
				const body = await json()
				const validated = schema.parse(body)
				await forward({ validatedBody: validated })
			} catch (error) {
				const issues = error.issues
					?.map((i: any) => `${i.path.join(".")}: ${i.message}`)
					.join(", ")
				resp(makeError(400, issues || "Validation failed"))
				safeExit()
			}
		},
	)

// Error handler
const errorHandler = middleware(async ({ tryNext, resp }) => {
	const result = await tryNext()
	result.match(
		(response) => resp(response),
		(error) => {
			console.error(error)
			resp(makeError(500, "Internal server error"))
		},
	)
})

// ============= Router Setup =============

const app = new Wooter()
	.use(errorHandler)
	.use(cookies)
	.use(json)

// ============= Routes =============

// List all books
app.route(c.chemin("books"), "GET", async ({ resp }) => {
	const books = await Array.fromAsync(
		kv.list<Book>({ prefix: ["books"] }),
	)

	resp(Response.json(
		books.map(({ key, value }) => ({ id: key[1], ...value })),
	))
})

// Get one book
app.route(c.chemin("books", c.pNumber("id")), "GET", async ({ params, resp }) => {
	const id = params.get("id")
	const entry = await kv.get<Book>(["books", id])

	const response = Option.from(entry.value)
		.match(
			(book) => Response.json(book),
			() => makeError(404, "Book not found"),
		)

	resp(response)
})

// Create book
app.route(c.chemin("books"), "POST", async ({ state: { validatedBody, json }, resp }) => {
	// Get or initialize next ID
	const idEntry = await kv.get<number>(["books", "nextId"])
	const id = (idEntry.value ?? 0) + 1

	// Atomic operation to prevent race conditions
	const result = await kv.atomic()
		.check({ key: ["books", "nextId"], versionstamp: idEntry.versionstamp })
		.set(["books", "nextId"], id)
		.set(["books", id], validatedBody)
		.commit()

	if (!result.ok) {
		return resp(makeError(500, "Failed to create book"))
	}

	resp(
		Response.json({ id, ...validatedBody }, { status: 201 }),
	)
})
	// Apply validation to POST /books
	.use(withValidation(bookSchema))

// Update book
app.route(c.chemin("books", c.pNumber("id")), "PUT", async ({ params, state: { validatedBody }, resp }) => {
	const id = params.get("id")
	const entry = await kv.get<Book>(["books", id])

	if (!entry.value) {
		return resp(makeError(404, "Book not found"))
	}

	const updated = { ...entry.value, ...validatedBody }
	const result = await kv.atomic()
		.check({ key: ["books", id], versionstamp: entry.versionstamp })
		.set(["books", id], updated)
		.commit()

	if (!result.ok) {
		return resp(makeError(409, "Conflict: book was modified"))
	}

	resp(Response.json(updated))
})
	.use(withValidation(bookSchema))

// Delete book
app.route(c.chemin("books", c.pNumber("id")), "DELETE", async ({ params, resp }) => {
	const id = params.get("id")
	await kv.delete(["books", id])
	resp(null, { status: 204 })
})

// View count tracking with cookies
app.route(c.chemin("api", "tracking"), "GET", async ({ state: { cookies }, resp }) => {
	const current = parseInt(cookies.get("viewCount") ?? "0") + 1
	cookies.set("viewCount", current.toString())

	resp(Response.json({ viewCount: current }))
})

// Search books
app.route(c.chemin("api", "search"), "GET", async ({ request, resp }) => {
	const url = new URL(request.url)
	const query = url.searchParams.get("q")?.toLowerCase()

	if (!query) {
		return resp(makeError(400, "Query parameter 'q' required"))
	}

	const books = await Array.fromAsync(
		kv.list<Book>({ prefix: ["books"] }),
	)

	const results = books.filter(({ value }) => {
		const book = value
		return (
			book.title.toLowerCase().includes(query) ||
			book.author.toLowerCase().includes(query)
		)
	})

	resp(Response.json(
		results.map(({ key, value }) => ({ id: key[1], ...value })),
	))
})

// Redirect old API
app.route(c.chemin("v1", "books"), "GET", async ({ resp }) => {
	resp(makeRedirect("/books", { status: 301 }))
})

// 404 handler
app.notFound(({ request, resp }) => {
	resp(makeError(404, `Not found: ${request.method} ${new URL(request.url).pathname}`))
})

// ============= Export =============

export default app.fetch

// ============= Usage Examples =============

/*
GET /books
  List all books

POST /books
  Create book
  Headers: Content-Type: application/json
  Body: { "title": "...", "author": "...", "isbn": "..." }

GET /books/1
  Get book with ID 1

PUT /books/1
  Update book
  Headers: Content-Type: application/json
  Body: { "title": "...", "author": "...", "isbn": "..." }

DELETE /books/1
  Delete book with ID 1

GET /api/search?q=author
  Search for books

GET /api/tracking
  Track views (uses cookies)
*/
```

## Running the Example

### Deno

```bash
deno run --allow-net --allow-read --unstable-kv server.ts
curl http://localhost:8000/books
```

### With Deno Serve

```ts
Deno.serve(app.fetch)
```

## Key Features

### Database

- Uses Deno KV for persistence
- Atomic operations prevent race conditions
- Auto-incrementing IDs

### Validation

- Zod schema validation in middleware
- Proper error messages
- Single validation middleware applied to relevant routes

### Error Handling

- Global error handler middleware
- Specific error types (404, 400, 409, 500)
- Meaningful error messages

### Cookies

- Session tracking with cookies
- Middleware automatically manages headers

### HTTP Status Codes

- `200` — Success (GET, POST, PUT)
- `201` — Created (POST response)
- `204` — No Content (DELETE)
- `400` — Bad Request (validation errors)
- `404` — Not Found
- `409` — Conflict (concurrency issues)
- `500` — Server Error

### JSON Handling

- Automatic JSON parsing
- Error handling for malformed JSON
- JSON responses with proper headers

## API Endpoints

### GET /books

List all books

Response:

```json
[
	{ "id": 1, "title": "Eloquent JavaScript", "author": "Marijn Haverbeke", "isbn": "9781593275846" }
]
```

### POST /books

Create a new book

Request body:

```json
{
	"title": "...",
	"author": "...",
	"isbn": "..."
}
```

### GET /books/:id

Get a specific book

### PUT /books/:id

Update a specific book

### DELETE /books/:id

Delete a specific book

### GET /api/search?q=query

Search books by title or author

### GET /api/tracking

Track view count (uses cookies)

## Testing

```bash
# List books
curl http://localhost:8000/books

# Create book
curl -X POST http://localhost:8000/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","author":"Author","isbn":"1234567890"}'

# Get book
curl http://localhost:8000/books/1

# Update book
curl -X PUT http://localhost:8000/books/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated","author":"Author","isbn":"1234567890"}'

# Delete book
curl -X DELETE http://localhost:8000/books/1

# Search
curl "http://localhost:8000/api/search?q=javascript"

# Tracking
curl http://localhost:8000/api/tracking
```

## Next Steps

- **[Middleware Patterns](./middleware-patterns.md)** — More middleware examples
- **[Error Handling](./error-handling.md)** — Error strategies
- **[Routing](../routing.md)** — Routing reference

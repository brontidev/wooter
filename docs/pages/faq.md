---
title: FAQ
---

# Frequently Asked Questions

## General

### What is Wooter?

Wooter is a fetch-native, type-safe router for JavaScript/TypeScript built around the principle that every request must produce a response. It supports middleware composition and works with any Fetch API-compatible runtime (Deno, Node.js, Cloudflare Workers, etc.).

### Is Wooter production-ready?

Wooter is in active development and the core API is stable. The project follows [epoch semver](https://antfu.me/posts/epoch-semver)—versions below v100 are pre-release. Avoid critical production usage until v100.0.0, but the library is suitable for non-critical projects and testing.

### Can I use Wooter with Node.js?

Yes! Wooter works with any runtime supporting the Fetch API, including Node.js 18+. Install via npm and use with frameworks like Express or create a standalone HTTP server.

### Does Wooter work with TypeScript?

Yes, Wooter is written entirely in TypeScript and provides full type safety for routes, middleware, and parameters.

## Routing

### How do I capture route parameters?

Use Chemin's parameter builders:

```ts
app.route(c.chemin("users", c.pNumber("id")), "GET", ({ params }) => {
  const id = params.get("id")  // type: number
})
```

### Can I use regular expressions for route parameters?

Yes, Chemin supports custom parameter validators. See the [Chemin custom parameters documentation](https://jsr.io/@dldc/chemin@13.0.0#custom-param) for detailed examples.

### How do I handle query parameters?

Query parameters are part of the URL. Access them via the `request` object:

```ts
app.route(c.chemin("search"), "GET", ({ request }) => {
  const url = new URL(request.url)
  const q = url.searchParams.get("q")
})
```

### What's the difference between `.route()` with method string vs object?

Both are valid. Choose based on preference:

```ts
// String
app.route(c.chemin("users"), "GET", handler)

// Object (recommended for multiple methods)
app.route(c.chemin("users"), {
  GET: handler1,
  POST: handler2,
})
```

## Middleware

### How do I add middleware that only applies to certain routes?

Use `branch()` to create a scoped router:

```ts
const api = app.branch(c.chemin("api"))
  .use(requireAuth)

api.route(c.chemin("users"), "GET", handler)
// /api/users has requireAuth applied
```

### Can middleware modify the request?

Yes, pass a modified request to `next()`:

```ts
const modified = new Request(request.url, { ...request })
const response = await next({}, modified)
```

### How do I add data to the context?

Pass an object to `next()` or `forward()`:

```ts
await next({ userId: 123, role: "admin" })
// Downstream handlers access via state.userId and state.role
```

## Error Handling

### What's the difference between `.next()` and `.forward()`?

- Use `forward()` when middleware only adds state (communicates transparency)
- Use `next()` when middleware needs the response

```ts
// Just adding state
await forward({ userId: 123 })

// Need the response
const response = await next()
resp(modifyResponse(response))
```

### How do I handle errors in middleware?

Use `tryNext()` to capture errors as `Result`:

```ts
const result = await tryNext()
result.match(
  (response) => resp(response),
  (error) => {
    // Handle error
    resp(new Response("Error", { status: 500 }))
  }
)
```

Or use try/catch:

```ts
try {
  const response = await next()
  resp(response)
} catch (error) {
  resp(new Response("Error", { status: 500 }))
}
```

### What are "stray errors"?

Stray errors are errors that occur after a response has already been sent. They're handled by the `catchStrayErrors` callback:

```ts
const app = new Wooter(undefined, (error) => {
  console.error("Stray error:", error)
})

app.route(c.chemin("example"), "GET", ({ resp }) => {
  resp(new Response("OK"))
  
  // This error occurs after response
  setTimeout(() => {
    throw new Error("Stray!")
  }, 100)
})
```

### What does `safeExit()` do?

`safeExit()` is an intentional stop signal. Use it when you've sent an error response and want to stop processing:

```ts
const json = middleware(async ({ request, resp, forward, safeExit }) => {
  let parsed: any
  await forward({
    json: async () => {
      if (parsed) return parsed
      try {
        return parsed = await request.json()
      } catch {
        resp(new Response("Invalid JSON", { status: 400 }))
        safeExit()  // Stop processing
      }
    },
  })
})
```

It's not an error—it's caught internally.

## Types & Validation

### How do I use Option and Result types?

These are utility types for functional error handling:

```ts
import { Option, some, none, Result, ok, err } from "@bronti/wooter"

// Option: value may or may not exist
const user = Option.from(maybeUser)
  .map(u => u.name)
  .unwrapOr("Unknown")

// Result: operation can fail
const result = ok(42)
result.match(
  (v) => console.log(v),
  (e) => console.log(e)
)
```

### Can I use Zod or other validation libraries?

Yes, any validation library works. You can use them in middleware or handlers:

```ts
import { z } from "npm:zod"

const schema = z.object({
  name: z.string(),
  email: z.string().email(),
})

app.route(c.chemin("users"), "POST", async ({ request, resp }) => {
  const body = await request.json()
  const result = schema.safeParse(body)
  
  if (!result.success) {
    return resp(new Response(JSON.stringify(result.error), { status: 400 }))
  }
  
  resp(Response.json(result.data, { status: 201 }))
})
```

## Performance & Scaling

### Is Wooter fast?

Wooter is lightweight with minimal overhead. It doesn't do much—just route matching and middleware composition. Performance depends mainly on your handlers.

### How many routes can Wooter handle?

Wooter should handle thousands of routes without issues. The internal router uses a graph-based structure for efficient matching.

### Does Wooter support HTTP/2 or HTTP/3?

Wooter doesn't implement HTTP protocols—it works with whatever runtime you use. The underlying runtime (Deno, Node.js, etc.) handles that.

## Advanced

### Can I use async/await in handlers?

Yes, all handlers and middleware can be async:

```ts
app.route(c.chemin("example"), "GET", async ({ resp }) => {
  const data = await fetchData()
  resp(Response.json(data))
})
```

### Can I nest routers multiple levels?

Yes:

```ts
const api = app.branch(c.chemin("api"))
const v1 = api.branch(c.chemin("v1"))
const users = v1.branch(c.chemin("users"))

users.route(c.chemin("me"), "GET", handler)
// Route: GET /api/v1/users/me
```

### Can middleware run after route handling?

Yes, use `next()` to capture the response:

```ts
const middleware = middleware(async ({ next, resp }) => {
  const response = await next()
  
  // Do something with response after route runs
  console.log("Route returned:", response.status)
  
  resp(response)
})
```

### Can I modify headers added by middleware?

Yes, manipulate the response before sending:

```ts
const response = await next()
const newResponse = new Response(response.body, response)
newResponse.headers.set("X-Custom", "value")
resp(newResponse)
```

### How do I handle file uploads?

File uploads are handled like any other request body. The `request` object includes `formData()`:

```ts
app.route(c.chemin("upload"), "POST", async ({ request, resp }) => {
  const form = await request.formData()
  const file = form.get("file")
  
  // Process file...
  resp(Response.json({ uploaded: true }))
})
```

### Can I use WebSockets?

Yes, Wooter is just HTTP routing. WebSocket upgrades happen in handlers:

```ts
app.route(c.chemin("ws"), "GET", async ({ request, resp }) => {
  if (request.headers.get("upgrade") !== "websocket") {
    return resp(new Response(null, { status: 501 }))
  }
  
  const { socket, response } = Deno.upgradeWebSocket(request)
  resp(response)
  
  socket.addEventListener("message", (event) => {
    // Handle WS messages
  })
})
```

## Common Patterns

### How do I create middleware for authentication?

See [Middleware Patterns: Authentication](./examples/middleware-patterns.md#authentication)

### How do I validate request bodies?

See [Error Handling: Validation with Error Collection](./examples/error-handling.md#validation-with-error-collection)

### How do I structure a larger application?

Consider:
- Using multiple routers via `branch()`
- Separating middleware into modules
- Creating custom middleware factories
- Organizing routes by feature

Example:
```ts
const app = new Wooter()
  .use(logging)
  .use(errorHandler)

const api = app.branch(c.chemin("api", "v1"))
  .use(auth)

const users = api.branch(c.chemin("users"))
users.route(c.chemin(), "GET", listUsers)
users.route(c.chemin(), "POST", createUser)
users.route(c.chemin(c.pNumber("id")), "GET", getUser)
```

## Getting Help

### Where can I find more information?

- **[Documentation](./index.md)** — Full docs
- **[Examples](./examples/basic-routes.md)** — Code examples
- **[JSR Package](https://jsr.io/@bronti/wooter)** — Package details
- **[GitHub Repository](https://github.com/dlcma/wooter)** — Source code

### How do I report a bug?

Report issues on the project's repository with:
- Clear description of the problem
- Minimal code reproduction
- Expected vs. actual behavior
- Your environment (Deno/Node version, OS, etc.)

### Can I contribute?

Yes! Check the repository for contribution guidelines. Common ways to help:
- Report bugs
- Improve documentation
- Add examples
- Suggest features

## Next Steps

- **[Documentation Index](./index.md)** — Browse all docs
- **[Quick Start](./quick-start.md)** — Get started
- **[API Reference](./api-reference.md)** — Complete API

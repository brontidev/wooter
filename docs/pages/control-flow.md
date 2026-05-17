---
title: Control Flow
---

# Control Flow

Middleware controls execution flow through `next()`, `forward()`, `tryNext()`, and `safeExit()`.

## next() — Receive and Send Response

`next()` passes control to the next handler and **waits for the response**:

```ts
const middleware = middleware(async ({ next, resp }) => {
  // Wait for downstream response
  const response = await next({ userId: 123 })
  
  // Now you have the response—modify it, log it, etc.
  console.log(`Got response: ${response.status}`)
  
  // Must explicitly send it
  resp(response)
})
```

Use `next()` when you need to:
- Inspect the response
- Modify the response
- Wrap or replace the response
- Make decisions based on the response

## forward() — Pass Through Response

`forward()` combines `next()` and automatic `resp()`:

```ts
const middleware = middleware(async ({ forward }) => {
  // Pass control downstream AND automatically respond with the result
  await forward({ userId: 123 })
  
  // Don't need to call resp()—forward() handles it
})
```

It's equivalent to:

```ts
const response = await next({ userId: 123 })
resp(response)
```

Use `forward()` when:
- Middleware only provides state/helpers
- You don't need to modify the response
- You want to communicate "I'm transparent to the response"

## When to Use Each

| Situation | Use |
|-----------|-----|
| Adding state only | `forward()` |
| Inspecting response | `next()` |
| Modifying response | `next()` |
| Adding headers to response | `next()` |
| Logging response | `next()` or `next()` + `forward()` |
| Error handling | `next()` or `tryNext()` |
| Rate limiting | `next()` (check before) or `forward()` |
| Request parsing | `forward()` |

## forward() Example

```ts
// JSON parsing middleware
const json = middleware<{ json: () => Promise<any> }>(async ({ request, forward, resp, safeExit }) => {
  let cached: any

  await forward({
    json: async () => {
      if (cached) return cached
      try {
        return cached = await request.clone().json()
      } catch {
        // If error, respond and exit
        resp(new Response("Invalid JSON", { status: 400 }))
        safeExit()
      }
    },
  })
})
```

This middleware only provides a helper function. It doesn't care about the response, so `forward()` is perfect.

## next() Example

```ts
// Logging middleware
const logging = middleware(async ({ request, next, resp }) => {
  const start = Date.now()
  
  // Get the response
  const response = await next()
  
  // Log it
  console.log(`${request.method} ${request.url} ${response.status} ${Date.now() - start}ms`)
  
  // Send it
  resp(response)
})
```

This middleware needs the response to log it, so `next()` is required.

## Modifying Responses with next()

```ts
const addSecurityHeaders = middleware(async ({ next, resp }) => {
  const response = await next()
  
  // Create new response with additional headers
  const newResponse = new Response(response.body, response)
  newResponse.headers.set("X-Content-Type-Options", "nosniff")
  newResponse.headers.set("X-Frame-Options", "DENY")
  
  resp(newResponse)
})
```

## tryNext() — Capture Errors

`tryNext()` is like `next()` but returns a `Result` instead of throwing:

```ts
const middleware = middleware(async ({ tryNext, resp }) => {
  const result = await tryNext()
  
  // result is Result<Response, unknown>
  result.match(
    (response) => resp(response),    // Success
    (error) => {                      // Error
      console.error(error)
      resp(new Response("Error", { status: 500 }))
    }
  )
})
```

Equivalent to try/catch:

```ts
const middleware = middleware(async ({ next, resp }) => {
  try {
    const response = await next()
    resp(response)
  } catch (error) {
    console.error(error)
    resp(new Response("Error", { status: 500 }))
  }
})
```

Choose whichever style you prefer. `tryNext()` with `.match()` is functional style, `try/catch` is imperative.

## tryForward() — Capture Errors + Auto Response

`tryForward()` is like `forward()` but returns a `Result`:

```ts
const middleware = middleware(async ({ tryForward }) => {
  const result = await tryForward({ userId: 123 })
  
  result.match(
    (response) => {
      // Already responded via resp()
    },
    (error) => {
      // Handle error if needed
      console.error(error)
    }
  )
})
```

This is less commonly used since `forward()` already handles responses automatically.

## safeExit() — Intentional Stop

`safeExit()` stops processing after sending a response:

```ts
const jsonParser = middleware(async ({ request, forward, resp, safeExit }) => {
  let parsed: unknown
  
  await forward({
    parseJson: async () => {
      if (parsed) return parsed
      try {
        return parsed = await request.json()
      } catch {
        // Send error response
        resp(new Response("Invalid JSON", { status: 400 }))
        // Stop processing—don't continue to routes
        safeExit()  // throws ControlFlowBreak internally
      }
    },
  })
})
```

`safeExit()` is **not an error**. It's an intentional exit signal that the framework handles gracefully.

### When to Use safeExit()

- ✅ After sending an error response that should stop processing
- ✅ In middleware that validates and responds
- ❌ Don't use for normal control flow
- ❌ Don't catch `safeExit()` in try/catch (it's handled internally)

## Execution Timeline

### With forward()

```ts
middleware1 (adds userId)
  ↓
middleware2 (adds permissions)
  ↓
route handler (responds)
  ↓
middleware2 receives response, calls resp()
  ↓
middleware1 receives response, calls resp()
  ↓
Done
```

### With next()

```ts
middleware1 (adds userId)
  ↓
middleware2 (adds permissions)
  ↓
route handler (responds)
  ↓
middleware2 receives response, can modify, calls resp()
  ↓
middleware1 receives response, can modify, calls resp()
  ↓
Done
```

### With Error in tryNext()

```ts
middleware1 (adds userId)
  ↓
middleware2 (adds permissions)
  ↓
route handler (throws error)
  ↓
middleware2 receives Result<err>, handles error, calls resp()
  ↓
middleware1 receives response, calls resp()
  ↓
Done
```

## Data Flow

When calling `next()` or `forward()` with data:

```ts
middleware1: await forward({ data1: "value1" })
  ↓
middleware2: receives state.data1 in scope
middleware2: await forward({ data2: "value2" })
  ↓
route: receives state.data1 and state.data2
```

Data accumulates as it flows downstream. Each middleware can add new state.

## Early Response Pattern

Middleware can respond early and stop route processing:

```ts
const auth = middleware(async ({ request, next, resp }) => {
  const token = request.headers.get("Authorization")
  
  if (!token) {
    // Respond early, never call next()
    return resp(new Response("Unauthorized", { status: 401 }))
  }
  
  // Has token, continue to next handler
  await next({ authenticated: true })
})
```

## Request Modification

Modify the request passed to downstream handlers:

```ts
const enrichRequest = middleware(async ({ request, next, resp }) => {
  // Modify request
  const newRequest = new Request(request.url, {
    ...request,
    headers: new Headers(request.headers),
  })
  newRequest.headers.set("X-Processed", "true")
  
  // Pass modified request to next()
  const response = await next({}, newRequest)
  resp(response)
})
```

## Best Practices

1. **Use `forward()` by default** — Simpler and communicates intent
2. **Use `next()` only when needed** — When you actually inspect/modify the response
3. **Handle errors in middleware** — Not in route handlers
4. **Use `tryNext()` or `try/catch`** — Choose your error style consistently
5. **Use `safeExit()` for intentional stops** — Not for normal control flow
6. **Document what your middleware adds** — Help maintainers understand data flow

## Common Patterns

### Middleware that only adds state → forward()
### Middleware that modifies response → next()
### Middleware that handles errors → tryNext() or try/catch
### Middleware that validates → forward() or early resp()

## Next Steps

- **[Middleware](./middleware.md)** — Learn middleware composition
- **[Error Handling](./examples/error-handling.md)** — Error handling patterns
- **[Examples](./examples/middleware-patterns.md)** — Real-world control flow

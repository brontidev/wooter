---
title: Middleware
---

# Middleware

Middleware enables composable, reusable request handling logic.

## Basic Middleware

A middleware is a function that receives a context, can enrich it with data, and must call either `next()`, `forward()`, or `resp()`:

```ts
import { Wooter, middleware } from "@bronti/wooter"

const timestamp = middleware<{ timestamp: number }>(async ({ next }) => {
  await next({ timestamp: Date.now() })
})

const app = new Wooter()
  .use(timestamp)
  .route(c.chemin("example"), "GET", async ({ state, resp }) => {
    resp(Response.json({ time: state.timestamp }))
  })
```

## Middleware Declaration

Use the `middleware` helper for type inference:

```ts
const customMiddleware = middleware<{ value: string }>(async ({ next }) => {
  await next({ value: "Hello" })
})
```

This tells TypeScript that this middleware adds `{ value: string }` to downstream state.

Without the helper:

```ts
const customMiddleware = async ({ next }) => {
  // TypeScript can't infer the type
  await next({ value: "Hello" })
}
```

The helper improves IDE autocomplete and compile-time checks.

## Chaining Middleware

Each middleware receives state from previous middleware:

```ts
const auth = middleware<{ user: User }>(async ({ request, next }) => {
  const user = parseJWT(request.headers.get("Authorization"))
  await next({ user })
})

const permissions = middleware<{ permissions: string[] }>(async ({ state: { user }, next }) => {
  const perms = await getPermissions(user.id)
  await next({ permissions: perms })
})

const app = new Wooter()
  .use(auth)          // Adds state.user
  .use(permissions)   // Can access state.user, adds state.permissions
  .route(c.chemin("admin"), "GET", async ({ state, resp }) => {
    // Can access state.user and state.permissions
    if (!state.permissions.includes("ADMIN")) {
      return resp(new Response("Forbidden", { status: 403 }))
    }
    resp(Response.json({ admin: true }))
  })
```

## Middleware with Helpers

Middleware can add helper functions, not just data:

```ts
const jsonMiddleware = middleware<{
  json: () => Promise<unknown>
}>(async ({ request, forward, resp, safeExit }) => {
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
})

const app = new Wooter()
  .use(jsonMiddleware)
  .route(c.chemin("users"), "POST", async ({ state: { json }, resp }) => {
    const user = await json()
    resp(Response.json(user), { status: 201 })
  })
```

## Responding from Middleware

Middleware can send a response and stop processing:

```ts
const requireAuth = middleware(async ({ request, resp, forward }) => {
  const token = request.headers.get("Authorization")
  
  if (!token) {
    // Respond and stop—routes won't be called
    return resp(new Response("Unauthorized", { status: 401 }))
  }
  
  // Continue if authorized
  await forward({ authenticated: true })
})
```

## Error Handling in Middleware

### Using `try/catch`

```ts
const errorHandler = middleware(async ({ tryNext, resp }) => {
  try {
    const response = await tryNext()
    resp(response)
  } catch (error) {
    console.error(error)
    resp(new Response("Internal Server Error", { status: 500 }))
  }
})
```

### Using `tryNext()` and Result

```ts
const errorHandler = middleware(async ({ tryNext, resp }) => {
  const result = await tryNext()
  
  result.match(
    (response) => resp(response),
    (error) => {
      console.error(error)
      resp(new Response("Error", { status: 500 }))
    }
  )
})
```

## Middleware on Branches

Apply middleware only to specific routes using `branch()`:

```ts
const publicRoutes = app.branch(c.chemin("public"))

const apiRoutes = app
  .branch(c.chemin("api"))
  .use(requireAuth)
  .use(rateLimiting)

publicRoutes.route(c.chemin("info"), "GET", ({ resp }) => {
  resp(Response.json({}))
})

apiRoutes.route(c.chemin("users"), "GET", ({ state, resp }) => {
  // Has state.user and rate limiting applied
  resp(Response.json([]))
})
```

## Using Standalone Middleware

Apply middleware directly to a route handler:

```ts
import { use } from "@bronti/wooter"

const validateUser = middleware<{ userId: string }>(async ({ request, next }) => {
  const id = request.headers.get("X-User-ID")
  await next({ userId: id })
})

const handler = async ({ state: { userId }, resp }) => {
  resp(Response.json({ userId }))
}

// Apply middleware just to this handler
const protected = use(validateUser, handler)

app.route(c.chemin("protected"), "GET", protected)
```

## Middleware for Cross-Cutting Concerns

Middleware is ideal for handling behavior that would otherwise be duplicated:

### Authentication

```ts
const auth = middleware<{ user: User }>(async ({ request, next, resp }) => {
  const token = request.headers.get("Authorization")?.split(" ")[1]
  
  if (!token) {
    return resp(new Response("Unauthorized", { status: 401 }))
  }
  
  try {
    const user = verifyToken(token)
    await next({ user })
  } catch {
    resp(new Response("Invalid token", { status: 403 }))
  }
})
```

### Request Logging

```ts
const logging = middleware(async ({ request, next, resp }) => {
  const start = Date.now()
  const response = await next()
  
  console.log(`${request.method} ${request.url} - ${response.status} ${Date.now() - start}ms`)
  resp(response)
})
```

### Rate Limiting

```ts
const rateLimiting = middleware(async ({ request, next, resp }) => {
  const ip = request.headers.get("X-Forwarded-For") || "unknown"
  
  if (isRateLimited(ip)) {
    return resp(new Response("Too Many Requests", { status: 429 }))
  }
  
  incrementRateLimit(ip)
  await next()
})
```

### Request Parsing

```ts
const cookieMiddleware = middleware<{ 
  cookies: CookieMap 
}>(async ({ request, next, resp }) => {
  const cookieHeader = request.headers.get("cookie") || ""
  const cookies = parseCookies(cookieHeader)
  
  const response = await next({ cookies })
  
  // Apply any cookie changes to response
  for (const [name, value] of cookies.entries()) {
    response.headers.set("Set-Cookie", `${name}=${value}`)
  }
  
  resp(response)
})
```

## Common Patterns

### Conditional Middleware

Only apply middleware under certain conditions:

```ts
if (env === "production") {
  app.use(rateLimiting)
}
```

### Middleware Factory

Create reusable middleware with configuration:

```ts
const withValidation = (schema) => middleware(async ({ request, resp, forward, safeExit }) => {
  const body = await request.json()
  const result = schema.safeParse(body)
  
  if (!result.success) {
    resp(Response.json(result.error.issues), { status: 400 })
    return safeExit()
  }
  
  await forward({ validatedBody: result.data })
})

app
  .use(withValidation(userSchema))
  .route(c.chemin("users"), "POST", ({ state: { validatedBody }, resp }) => {
    resp(Response.json(validatedBody), { status: 201 })
  })
```

### Middleware Composition

Combine multiple middleware pieces:

```ts
const composed = middleware(async ({ next }) => {
  await auth(ctx)
  await permissions(ctx)
  await logging(ctx)
  await next()
})
```

## Best Practices

1. **Use `forward()` when you only add state** — Communicates intent
2. **Use `next()` when you need the response** — More explicit than silent propagation
3. **Handle errors in middleware, not routes** — Keeps routes focused
4. **Name middleware by what they provide** — `withUser`, `withAuth`, `withJSON`
5. **Keep middleware focused** — Single responsibility
6. **Document type parameters** — Help others know what state is added

## Next Steps

- **[Control Flow](./control-flow.md)** — Deep dive into next() vs forward()
- **[Error Handling](./examples/error-handling.md)** — Patterns for error management
- **[Examples](./examples/middleware-patterns.md)** — Real-world middleware

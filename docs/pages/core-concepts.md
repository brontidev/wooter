---
title: Core Concepts
---

# Core Concepts

Understanding Wooter's mental model will help you write better code.

## The Response-First Lifecycle

The core principle of Wooter is simple but powerful:

> **Every request must produce a response before the lifecycle completes.**

This means a request is **not** considered successfully handled when a route handler returns. It's handled when a response has been produced.

### The Lifecycle Flow

```
Request arrives
    ↓
Middleware layer 1 (can respond, or call next())
    ↓
Middleware layer 2 (can respond, or call next())
    ↓
Matched route handler (must respond)
    ↓
Response is sent
    ↓
Lifecycle considered complete
```

The response can originate from:
- Middleware (intentionally handling the request)
- A route handler (normal case)
- Error handlers or helpers

Wooter doesn't distinguish between these sources. **Only the response matters.**

### What This Means

If a handler exits without calling `resp()`, Wooter throws `HandlerDidntRespondError`:

```ts
// ❌ This will error
app.route(c.chemin("bad"), "GET", async ({ resp }) => {
  // Forgot to call resp()!
})

// ✅ This works
app.route(c.chemin("good"), "GET", async ({ resp }) => {
  resp(new Response("OK"))
})
```

If a handler calls `resp()` twice, Wooter throws `HandlerRespondedTwiceError`:

```ts
// ❌ This will error
app.route(c.chemin("bad"), "GET", async ({ resp }) => {
  resp(new Response("First"))
  resp(new Response("Second"))  // Error!
})
```

## Happy-Path Programming

Wooter encourages handlers to describe *successful* work, not error checking:

### Without Wooter

```ts
app.get("/books/:id", (req, res) => {
  const id = req.params.id
  if (!id) {
    return res.status(400).json({ error: "ID required" })
  }
  
  const book = db.get(id)
  if (!book) {
    return res.status(404).json({ error: "Book not found" })
  }
  
  res.json(book)
})
```

### With Wooter

Validation and error handling happen in middleware, while handlers focus on the happy path:

```ts
// Middleware provides a helper function that handles errors
const withBook = middleware<{ 
  getBook: (id: string) => Promise<Book | null>
}>(
  async ({ params, resp, forward, safeExit }) => {
    const getBook = async (id: string) => {
      const book = db.get(id)
      if (!book) {
        resp(new Response("Book not found", { status: 404 }))
        safeExit()  // Stop execution of route handler
        return null
      }
      return book
    }
    
    await forward({ getBook })
  }
)

// Route focuses on happy path, using the helper
app
  .use(withBook)
  .route(c.chemin("books", c.pString("id")), "GET", async ({ state: { getBook }, params, resp }) => {
    const book = await getBook(params.get("id"))
    if (book) {
      resp(Response.json(book))
    }
  })
```

The route handler is cleaner because error handling is extracted to a reusable middleware helper.

## State Accumulates

Each middleware can add capabilities that downstream handlers consume:

```ts
const app = new Wooter()
  .use(async ({ next }) => {
    // Middleware 1: add user
    await next({ user: getCurrentUser() })
  })
  .use(async ({ state: { user }, next }) => {
    // Middleware 2: can see user, add perms
    await next({ 
      permissions: getPermissions(user)
    })
  })
  .use(async ({ state: { user, permissions }, next }) => {
    // Middleware 3: can see user and perms, add helpers
    await next({ 
      authorize: (perm) => permissions.includes(perm)
    })
  })
  .route(c.chemin("admin"), "GET", async ({ state, resp }) => {
    // Route can access all accumulated state
    if (!state.authorize("ADMIN")) {
      return resp(new Response("Forbidden", { status: 403 }))
    }
    resp(Response.json({ admin: true }))
  })
```

Important: State is **additive**. Middleware should generally add capabilities, not replace existing state.

## Explicit Response Propagation

Middleware must explicitly choose how to handle downstream responses. This prevents hidden behavior:

### `forward()` — Propagate Downstream Response

Use when middleware only provides state:

```ts
const middleware = async ({ request, next, resp }) => {
  // Get timestamp and pass downstream
  await forward({ 
    startTime: Date.now()
  })
  // forward() automatically responds with the downstream response
}
```

This tells readers: "I don't need the response."

### `next()` — Inspect or Modify Response

Use when middleware needs to see or modify the response:

```ts
const loggingMiddleware = async ({ request, next, resp }) => {
  // Get the downstream response
  const response = await next()
  
  // Log it
  console.log(request.method, response.status)
  
  // Respond with it (or a modified version)
  resp(response)
}
```

This tells readers: "I'm interested in the response."

### `tryNext()` — Capture Errors

Use when you want to catch errors as `Result` instead of throwing:

```ts
const errorHandling = async ({ tryNext, resp }) => {
  const result = await tryNext()
  
  result.match(
    (response) => resp(response),  // Success
    (error) => {                    // Error
      console.error(error)
      resp(new Response("Error", { status: 500 }))
    }
  )
}
```

## Stray Errors

Errors that occur **after** a response has been sent are called **stray errors**. They're handled by the `catchStrayErrors` callback:

```ts
const app = new Wooter(undefined, (error) => {
  console.error("Stray error:", error)
})

app.route(c.chemin("example"), "GET", async ({ resp }) => {
  resp(new Response("OK"))
  
  // This error occurs after response is sent
  await delay(1000)
  throw new Error("Stray error!")
})
```

Wooter can't prevent this error from happening (the response already left), but it calls your `catchStrayErrors` handler so you can log it.

## Safe Exit

Use `safeExit()` when you intentionally stop processing after sending a response:

```ts
const jsonMiddleware = async ({ request, resp, forward, safeExit }) => {
  let json: unknown
  
  await forward({
    json: async () => {
      if (json) return json
      try {
        return json = await request.json()
      } catch {
        // Send error response
        resp(new Response("Invalid JSON", { status: 400 }))
        // Stop processing—don't continue to route
        safeExit()  // throws ControlFlowBreak internally
      }
    },
  })
}
```

`safeExit()` is not an error—it's an intentional exit signal. The framework catches it and doesn't report an error.

## Middleware Must Call next()

Every middleware must eventually call either:
- `next()` or `forward()` to continue to the next handler
- `resp()` to send a response and stop

If middleware exits without doing either, Wooter throws `MiddlewareHandlerDidntCallUpError`:

```ts
// ❌ Error: didn't continue or respond
app.use(async ({ }) => {
  // Nothing called!
})

// ✅ Continue to next handler
app.use(async ({ forward }) => {
  await forward({ userId: 123 })
})

// ✅ Send response and stop
app.use(async ({ resp }) => {
  if (someCondition) {
    resp(new Response("Blocked", { status: 403 }))
  }
})
```

## Type Safety

Wooter uses TypeScript generics to ensure type safety at compile time:

```ts
// This middleware adds { user: User } to state
const withUser = async ({ next }) => {
  await next({ user: { id: 1, name: "Alice" } })
}

const app = new Wooter()
  .use(withUser)
  .route(c.chemin("profile"), "GET", async ({ state, resp }) => {
    // TypeScript knows state.user exists and is of type User
    resp(Response.json(state.user))
  })
```

The router's type parameter reflects accumulated middleware state:

```ts
type Router0 = Wooter<undefined>
const app1 = new Wooter().use(m1)
type Router1 = Wooter<{ user: User }>

const app2 = app1.use(m2)
type Router2 = Wooter<{ user: User; permissions: string[] }>
```

This ensures routes can only access state that middleware actually provides.

## Next Steps

- **[Routing](./routing.md)** — Learn path matching and parameters
- **[Middleware](./middleware.md)** — Compose complex middleware chains
- **[Control Flow](./control-flow.md)** — Deep dive into next(), forward(), tryNext()

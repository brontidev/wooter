---
title: Wooter
---

# @bronti/wooter

[![JSR](https://jsr.io/badges/@bronti/wooter)](https://jsr.io/@bronti/wooter)
[![JSR Score](https://jsr.io/badges/@bronti/wooter/score)](https://jsr.io/@bronti/wooter)

> [!WARNING]
> wooter is beta and WIP. Core ideas are implemented, but rough edges still exist. Avoid high-impact production usage until
> `v100.0.0`.

> [!NOTE]
> wooter uses [epoch semver](https://antfu.me/posts/epoch-semver).


A fetch-native, type-safe routing and middleware framework for JavaScript/TypeScript built on explicit guarantees and implementation freedom.

## What is Wooter?

Wooter is a lightweight router designed for modern JavaScript runtimes (Deno, Node.js, edge functions, browsers) that treats HTTP routing as a composition of middleware and route handlers around a single core principle:

> **Every request must produce a response before the lifecycle completes.**

This invariant drives all design decisions, while giving developers complete freedom in how they build on top of it.

## Key Philosophy

### Response-First Lifecycle

Unlike many frameworks that are route-first, Wooter is **response-first**. A request is considered successfully handled when a response has been produced—regardless of whether it came from middleware, a route handler, or error handling logic.

```
Request
  ↓
Middleware (can respond)
  ↓
Route (can respond)
  ↓
Response Produced
  ↓
Lifecycle Complete
```

### Happy-Path Programming

Wooter encourages handlers to focus on successful execution:

```ts
const body = await state.parseJson(schema)
const task = await doTask(body)

resp.json(task)
```

Error handling is typically delegated to middleware, not scattered throughout routes.

### Middleware Accumulates State

Each middleware layer can add capabilities that downstream handlers consume:

```ts
app
  .use(authentication)      // Adds state.user
  .use(json)               // Adds state.parseJson
  .use(validation)         // Adds state.validate
  
// Routes now have access to all contributed state
```

### Explicit Response Propagation

Middleware must explicitly choose how to handle downstream responses:

- **`forward()`** — Pass through downstream response automatically (middleware just provides state)
- **`next()`** — Inspect, modify, or replace the downstream response

This explicitness prevents hidden behavior and makes data flow visible.

## Quick Example

```ts
import { Wooter, c } from "@bronti/wooter"
import jsonMiddleware from "./middleware/json.ts"

const app = new Wooter()
  .use(jsonMiddleware)
  .route(c.chemin("books"), {
    GET: async ({ resp }) => {
      resp(Response.json(["Book 1", "Book 2"]))
    },
    POST: async ({ state: { parseJson }, resp }) => {
      const book = await parseJson(bookSchema)
      // Save book...
      resp(Response.json(book), { status: 201 })
    },
  })
  .route(c.chemin("books", c.pNumber("id")), "GET", async ({ params, resp }) => {
    const id = params.get("id")
    const book = await getBook(id)
    resp(Response.json(book))
  })

export default app
```

## Getting Started

- **[Installation](./installation.md)** — Add Wooter to your project
- **[Quick Start](./quick-start.md)** — Build your first router in 5 minutes
- **[Core Concepts](./core-concepts.md)** — Understand the response-first lifecycle
- **[Routing](./routing.md)** — Master type-safe path matching
- **[Middleware](./middleware.md)** — Compose powerful middleware chains

## Core Topics

- **[Control Flow](./control-flow.md)** — next(), forward(), tryNext(), safeExit()
- **[Type Reference: Option & Result](./util-types/option-result.md)** — Rust-style error handling
- **[Path Building: Chemin](./util-types/chemin-routing.md)** — Type-safe route parameters
- **[API Reference](./api-reference.md)** — Complete API documentation

## Guides & Examples

- **[Basic Routing](./examples/basic-routes.md)** — Simple GET/POST examples
- **[Middleware Patterns](./examples/middleware-patterns.md)** — Real-world middleware
- **[Error Handling](./examples/error-handling.md)** — Exception vs Result patterns
- **[Real-World Example](./examples/real-world.md)** — Full CRUD API with cookies
- **[FAQ](./faq.md)** — Common questions

## Status

Wooter is published to [JSR](https://jsr.io/@bronti/wooter) and actively maintained. The core API is stable, but the library follows [epoch semver](https://antfu.me/posts/epoch-semver)—it won't reach v100 until public stability is guaranteed.

## Why Wooter?

1. **Type-Safe by Default** — Full TypeScript support with compile-time route validation
2. **Fetch-Native** — Works with any runtime supporting the Fetch API
3. **Explicit Model** — No hidden behavior, visible data flow, transparent response handling
4. **Composable** — Middleware and routers nest cleanly with type inference
5. **Lightweight** — No runtime dependencies beyond standard library equivalents
6. **Framework Agnostic** — Use exceptions, Result types, or custom error handling—Wooter supports all approaches

## Learn More

- **[Read PHILOSOPHY.MD](../PHILOSOPHY.MD)** for detailed design rationale
- **[Explore examples/](../../examples)** for real-world patterns
- **[View on JSR](https://jsr.io/@bronti/wooter)** for package details

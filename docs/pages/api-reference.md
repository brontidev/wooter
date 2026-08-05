---
title: API Reference
---

# API Reference

Complete reference for Wooter's public API.

## Main Class: Wooter

```ts
class Wooter<TState = undefined, TParentParams = undefined>
```

Main router class for registering routes and middleware.

### Constructor

```ts
new Wooter(basePath?, catchStrayErrors?)
```

**Parameters:**

- `basePath` (optional) — Base path for this router instance
- `catchStrayErrors` (optional) — Callback for errors after response sent

**Example:**

```ts
const app = new Wooter(undefined, (error) => {
	console.error("Stray error:", error)
})
```

### Methods

#### `.route(path, method, handler)`

Register a route for one or more HTTP methods.

```ts
app.route(c.chemin("users"), "GET", async ({ resp }) => {
	resp(Response.json([]))
})
```

**Overloads:**

- `.route(path, method, handler)` — Single method
- `.route(path, methods, handler)` — Array of methods
- `.route(path, handler)` — Method-to-handler map

#### `.use(middleware)`

Add middleware to this router.

```ts
app.use(async ({ next }) => {
	await next({ userId: 123 })
})
```

**Returns:** Typed router with updated state

#### `.branch(basePath)`

Create a child router mounted at a path.

```ts
const api = app.branch(c.chemin("api"))
api.route(c.chemin("users"), "GET", ...)
// Route: GET /api/users
```

#### `.notFound(handler)`

Register a fallback handler for unmatched routes.

```ts
app.notFound(({ resp }) => {
	resp(new Response("Not found", { status: 404 }))
})
```

#### `.fetch(request)`

Dispatch a request through the router.

```ts
const response = await app.fetch(request)

// Export for use with HTTP server
export default app.fetch
```

## Context Objects

### RouteContext

```ts
class RouteContext<TParams, TState>
```

Context passed to route handlers.

**Properties:**

- `.request` — The incoming `Request` object
- `.url` — Parsed `URL` object
- `.params` — `TypedMap` of route parameters
- `.state` — Accumulated middleware state

**Methods:**

- `.resp(response)` — Send a response
- `.resp(body, init)` — Send response with body and init
- `.json(data, init)` — Send JSON response
- `.ok()` — Mark execution successful (internal)
- `.safeExit()` — Stop processing intentionally (throws `ControlFlowBreak`)

**Example:**

```ts
app.route(c.chemin("users", c.pNumber("id")), "GET", async ({ params, resp }) => {
	const userId = params.get("id")
	resp(Response.json({ userId }))
})
```

### MiddlewareContext

```ts
class MiddlewareContext<TParams, TState, TNextState> extends RouteContext
```

Context passed to middleware handlers. Extends `RouteContext` with flow control.

**Additional Methods:**

- `.next(data?, request?)` — Continue to next handler, receive response
- `.forward(data?, request?)` — Continue to next handler, auto-respond
- `.tryNext(data?, request?)` — Like `next()` but returns `Result`
- `.tryForward(data?, request?)` — Like `forward()` but returns `Result`

**Example:**

```ts
const auth = middleware(async ({ request, next, resp }) => {
	const token = request.headers.get("Authorization")

	if (!token) {
		return resp(new Response("Unauthorized", { status: 401 }))
	}

	const user = verifyToken(token)
	const response = await next({ user })
	resp(response)
})
```

## Type Exports

### Params

```ts
type Params = Record<string, unknown>
```

Generic shape for route parameters.

### State

```ts
type State = Record<string, unknown>
```

Generic shape for context state.

### RouteHandler

```ts
type RouteHandler<TParams = Params, TState = State> = (ctx: RouteContext<TParams, TState>) => Promise<unknown> | unknown
```

Function type for route handlers.

### MiddlewareHandler

```ts
type MiddlewareHandler<TParams = Params, TState = State, TNextState = State> = (
	ctx: MiddlewareContext<TParams, TState, TNextState>,
) => Promise<unknown> | unknown
```

Function type for middleware handlers.

### MethodDefinitionInput

```ts
type MethodDefinitionInput = "GET" | "PUT" | "POST" | "PATCH" | "DELETE" | "OPTIONS" | MethodDefinitionInput[] | "*"
```

HTTP methods for route registration.

### MethodDefinitions

```ts
type MethodDefinitions<TParams, TState> = Partial<Record<Methods, RouteHandler<TParams, TState>>>
```

Map of HTTP methods to handlers.

### Methods

```ts
type Methods = "GET" | "PUT" | "POST" | "PATCH" | "DELETE" | "OPTIONS"
```

Supported HTTP methods.

## Response Helpers

### `makeRedirect(location, init?)`

Create a redirect response.

```ts
import { makeRedirect } from "@bronti/wooter"

resp(makeRedirect("/new-path", { status: 301 }))
```

**Parameters:**

- `location` — Redirect destination
- `init` (optional) — Response init, defaults to status `307`

**Returns:** `Response` with `Location` header

### `makeError(status, message?, headers?)`

Create an error response.

```ts
import { makeError } from "@bronti/wooter"

resp(makeError(404, "Not found"))
```

**Parameters:**

- `status` — HTTP status code
- `message` (optional) — Error message for body
- `headers` (optional) — Response headers

**Returns:** `Response`

## Middleware Helper

### `middleware<TNextState, TState?, TParams?>(handler)`

Type helper for middleware declarations.

```ts
import { middleware } from "@bronti/wooter"

const myMiddleware = middleware<{ value: string }>(async ({ next }) => {
	await next({ value: "Hello" })
})
```

## Utility Types

### Option<T>

Optional value wrapper.

```ts
import { none, Option, some } from "@bronti/wooter"

const opt: Option<string> = some("value")
opt.match(
	(v) => console.log(v),
	() => console.log("no value"),
)
```

**Methods:**

- `.isSome()` / `.isNone()` — Check presence
- `.unwrap()` — Get value or throw
- `.unwrapOr(default)` — Get value or default
- `.map(fn)` — Transform value
- `.flatMap(fn)` — Chain operations
- `.match(onSome, onNone)` — Pattern match

### Result<T, E>

Success or error wrapper.

```ts
import { err, ok, Result } from "@bronti/wooter"

const res: Result<number, string> = ok(42)
res.match(
	(v) => console.log(v),
	(e) => console.log(e),
)
```

**Methods:**

- `.isOk()` / `.isErr()` — Check success/failure
- `.unwrap()` — Get value or throw
- `.unwrapErr()` — Get error or throw
- `.map(fn)` — Transform value
- `.mapErr(fn)` — Transform error
- `.flatMap(fn)` — Chain operations
- `.match(onOk, onErr)` — Pattern match

## Chemin Exports

Wooter re-exports everything from [@dldc/chemin](https://jsr.io/@dldc/chemin):

```ts
import { c } from "@bronti/wooter"

c.chemin() // Build paths
c.pString("name") // String parameter
c.pNumber("id") // Number parameter
c.p("id", /regex/) // Custom pattern
```

## Error Types

### WooterError

Base class for Wooter errors.

```ts
import { WooterError } from "@bronti/wooter"

if (error instanceof WooterError) {
	console.log(error.message)
}
```

### HandlerDidntRespondError

Thrown when a handler exits without calling `resp()`.

```ts
// ❌ Throws HandlerDidntRespondError
app.route(c.chemin("bad"), "GET", async ({}) => {})
```

### HandlerRespondedTwiceError

Thrown when a handler calls `resp()` multiple times.

```ts
// ❌ Throws HandlerRespondedTwiceError
app.route(c.chemin("bad"), "GET", async ({ resp }) => {
	resp(new Response("First"))
	resp(new Response("Second"))
})
```

### MiddlewareHandlerDidntCallUpError

Thrown when middleware exits without calling `next()` or `resp()`.

```ts
// ❌ Throws MiddlewareHandlerDidntCallUpError
app.use(async ({}) => {})
```

### ControlFlowBreak

Special symbol used by `safeExit()` to stop processing. Not an error.

```ts
// ✅ Correct
if (error) {
	resp(errorResponse)
	safeExit() // Uses ControlFlowBreak internally
}
```

## Data Types

### TypedMap

TypeScript-friendly map for route parameters.

```ts
params: TypedMap<{ id: number; userId: string }>

params.get("id") // number
params.has("id") // boolean
params.entries() // Iterable<[string, unknown]>
```

## Constants

### `isWooterError(value)`

Check if value is a `WooterError`.

```ts
import { isWooterError } from "@bronti/wooter"

if (isWooterError(error)) {
	// Handle Wooter error
}
```

## Complete Export List

```ts
export { default as Wooter }
export { default as middleware }
export { default as use }
export * as c  // Chemin
export { Option, some, none }
export { Result, ok, err }
export { makeRedirect, makeError }
export { WooterError, ControlFlowBreak, isWooterError }
export { 
  HandlerDidntRespondError,
  HandlerRespondedTwiceError,
  MiddlewareHandlerDidntCallUpError
}
export type { Params, State }
export type { RouteContext, RouteHandler }
export type { MiddlewareContext, MiddlewareHandler }
export type { MethodDefinitionInput, MethodDefinitions, Methods }
```

## TypedMap API

The params object is a `TypedMap`:

```ts
app.route(c.chemin("users", c.pString("id")), "GET", ({ params }) => {
	params.get("id") // string | undefined
	params.getOrThrow("id") // string (throws if not present)
	params.has("id") // boolean
	params.entries() // Iterable<[string, unknown]>
})
```

## Next Steps

- **[Middleware Reference](../middleware.md)** — Middleware patterns
- **[Control Flow Reference](../control-flow.md)** — next(), forward(), tryNext()
- **[FAQ](../faq.md)** — Common questions

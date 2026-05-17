---
title: Path Building with Chemin
---

# Path Building with Chemin

Wooter uses [Chemin](https://jsr.io/@dldc/chemin) for type-safe path routing. This guide covers Wooter-specific patterns; for complete Chemin documentation, see [the Chemin repository](https://jsr.io/@dldc/chemin).

## Basic Paths

Use `c.chemin()` to build paths:

```ts
import { c } from "@bronti/wooter"

// Root
c.chemin()

// Single segment
c.chemin("users")

// Multiple segments
c.chemin("api", "v1", "users")

// Nested paths
c.chemin("api", c.chemin("v1", "users"))
```

## Dynamic Parameters

Add dynamic segments with parameter builders:

### String Parameters

```ts
c.pString("id")

app.route(c.chemin("users", c.pString("id")), "GET", ({ params }) => {
  const id = params.get("id")  // type: string
})
```

### Number Parameters

```ts
c.pNumber("postId")

app.route(c.chemin("posts", c.pNumber("postId")), "GET", ({ params }) => {
  const postId = params.get("postId")  // type: number
})
```

### Custom Patterns

Use `.p()` for custom regex patterns:

```ts
// UUID pattern
const uuid = c.p("id", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

app.route(c.chemin("items", uuid), "GET", ({ params }) => {
  const id = params.get("id")
})

// Slug pattern
const slug = c.p("slug", /^[a-z0-9-]+$/)

app.route(c.chemin("posts", slug), "GET", ({ params }) => {
  const slug = params.get("slug")
})

// Hex color
const color = c.p("color", /^[0-9a-f]{6}$/i)

app.route(c.chemin("colors", color), "GET", ({ params }) => {
  const color = params.get("color")
})
```

## Combining Paths

Combine paths using `c.chemin()`:

```ts
// Linear combination
const basePath = c.chemin("api", "v1")
const userPath = c.chemin(basePath, "users")
const userIdPath = c.chemin(userPath, c.pString("id"))

// In routes
app.route(c.chemin(basePath, "posts"), "GET", ({ resp }) => {
  resp(Response.json([]))
})

// Equivalent to
app.route(c.chemin("api", "v1", "posts"), "GET", ({ resp }) => {
  resp(Response.json([]))
})
```

## Nested Router Paths

When using `branch()`, the parent's path becomes the base:

```ts
const api = app.branch(c.chemin("api"))

// Routes on api are prefixed with /api/
api.route(c.chemin("users"), "GET", ({ resp }) => {
  resp(Response.json([]))  // GET /api/users
})

api.route(c.chemin("posts", c.pNumber("id")), "GET", ({ params, resp }) => {
  resp(Response.json({ id: params.get("id") }))  // GET /api/posts/{id}
})

// Nested branch
const v1 = api.branch(c.chemin("v1"))

v1.route(c.chemin("users"), "GET", ({ resp }) => {
  resp(Response.json([]))  // GET /api/v1/users
})
```

## Parameter Access

Use `params.get()` to access captured parameters:

```ts
app.route(c.chemin("users", c.pString("userId"), "posts", c.pNumber("postId")), "GET", ({ params }) => {
  const userId = params.get("userId")    // type: string
  const postId = params.get("postId")    // type: number
  
  resp(Response.json({ userId, postId }))
})
```

## Type Safety

Chemin provides compile-time type safety. TypeScript will catch mismatches:

```ts
// Define path with userId param
const path = c.chemin("users", c.pString("userId"))

app.route(path, "GET", ({ params }) => {
  // ✅ Correct
  params.get("userId")
  
  // ❌ Error: 'postId' doesn't exist
  params.get("postId")
})

// Different path
const path2 = c.chemin("posts", c.pNumber("postId"))

app.route(path2, "GET", ({ params }) => {
  // ❌ Error: can't access userId
  params.get("userId")
})
```

## Common Patterns

### RESTful Paths

```ts
// List
app.route(c.chemin("items"), "GET", ({ resp }) => {
  resp(Response.json([]))
})

// Get one
app.route(c.chemin("items", c.pNumber("id")), "GET", ({ params, resp }) => {
  resp(Response.json({ id: params.get("id") }))
})

// Create
app.route(c.chemin("items"), "POST", ({ request, resp }) => {
  resp(Response.json({}), { status: 201 })
})

// Update
app.route(c.chemin("items", c.pNumber("id")), "PUT", ({ params, request, resp }) => {
  resp(Response.json({ id: params.get("id") }))
})

// Delete
app.route(c.chemin("items", c.pNumber("id")), "DELETE", ({ params, resp }) => {
  resp(null, { status: 204 })
})
```

### Nested Resources

```ts
// /users/{userId}/posts/{postId}
app.route(
  c.chemin("users", c.pNumber("userId"), "posts", c.pNumber("postId")),
  "GET",
  ({ params, resp }) => {
    resp(Response.json({
      userId: params.get("userId"),
      postId: params.get("postId"),
    }))
  }
)
```

### API Versioning

```ts
const v1 = app.branch(c.chemin("api", "v1"))
const v2 = app.branch(c.chemin("api", "v2"))

v1.route(c.chemin("users"), "GET", ({ resp }) => {
  resp(Response.json([], { headers: { "API-Version": "1" } }))
})

v2.route(c.chemin("users"), "GET", ({ resp }) => {
  resp(Response.json([{ id: 1, name: "Alice" }], { headers: { "API-Version": "2" } }))
})
```

### Admin Namespace

```ts
const admin = app.branch(c.chemin("admin")).use(requireAdmin)

admin.route(c.chemin("users"), "GET", ({ resp }) => {
  resp(Response.json([]))
})

admin.route(c.chemin("settings"), "GET", ({ resp }) => {
  resp(Response.json({}))
})
```

## Optional Segments

Chemin supports optional segments. This is less common in HTTP routing, but available:

```ts
// Query params are better for optional filtering
app.route(c.chemin("users"), "GET", ({ request, resp }) => {
  const url = new URL(request.url)
  const page = url.searchParams.get("page") || "1"
  resp(Response.json({}))
})
```

## Query Parameters

Query parameters are separate from path parameters. Access via `URL`:

```ts
app.route(c.chemin("users"), "GET", ({ request, resp }) => {
  const url = new URL(request.url)
  const search = url.searchParams.get("q")
  const page = url.searchParams.get("page")
  
  resp(Response.json([]))
})

// GET /users?q=alice&page=2
```

## TypedMap

Parameters are accessed through a `TypedMap`:

```ts
app.route(c.chemin("posts", c.pNumber("id")), "GET", ({ params, resp }) => {
  // params is a TypedMap with 'id' property
  const id = params.get("id")
  
  // Can also check existence
  const exists = params.has("id")  // true
  
  // Can iterate
  for (const [key, value] of params.entries()) {
    console.log(key, value)
  }
})
```

## Root Path

Use empty `c.chemin()` for the root:

```ts
app.route(c.chemin(), "GET", ({ resp }) => {
  resp(new Response("Home"))
})

// Equivalent to:
app.route(c.chemin(""), "GET", ({ resp }) => {
  resp(new Response("Home"))
})
```

## Next Steps

- **[Routing](../routing.md)** — Wooter routing guide
- **[Routing Examples](../examples/basic-routes.md)** — Real path patterns
- **[Chemin Docs](https://jsr.io/@dldc/chemin)** — Full Chemin reference

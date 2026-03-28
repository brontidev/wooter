---
title: Routing
description: Define paths with chemin patterns, methods, and nested routers.
sidebar:
    order: 5
---

## Pattern-Based Paths

Define routes with `c.chemin(...)`:

```ts
router.route(c.chemin("users", c.pNumber("id")), "GET", ({ params, resp }) => {
	resp.json({ id: params.get("id") })
})
```

Useful path pieces:

- `c.pString("name")`
- `c.pNumber("id")`
- `c.pOptionalConst("delete")`
- `c.pOptional(...)`

## Methods

Single method:

```ts
router.route(c.chemin("users"), "GET", ({ resp }) => resp.json([]))
```

Multiple methods:

```ts
router.route(c.chemin("users"), ["GET", "POST"], ({ resp }) => resp(new Response("ok")))
```

Method map:

```ts
router.route(c.chemin("users"), {
	GET: ({ resp }) => resp.json([]),
	POST: ({ resp }) => resp(new Response(null, { status: 201 })),
})
```

Wildcard method:

```ts
router.route(c.chemin("health"), "*", ({ resp }) => resp(new Response("ok")))
```

## Nested Routers

```ts
const api = router.router(c.chemin("api"))
const posts = api.router(c.chemin("posts"))

posts.route(c.chemin(c.pNumber("id")), "GET", ({ params, resp }) => {
	resp.json({ id: params.get("id") })
})
```

Nested routers preserve path typing while composing larger route trees.

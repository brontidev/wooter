---
title: Getting Started
description: Install wooter, register routes, and serve requests through fetch.
sidebar:
  order: 1
---

wooter is runtime-agnostic. You define routes and call `fetch`.

## Install

```sh
# JSR
deno add jsr:@bronti/wooter
```

## First Router

```ts
import { c, Wooter } from "jsr:@bronti/wooter"

const router = new Wooter()

router.route(c.chemin(), "GET", ({ resp }) => {
	resp(new Response("hello"))
})

router.route(c.chemin("posts", c.pNumber("id")), "GET", ({ params, resp }) => {
	resp.json({ postId: params.get("id") })
})

export default router
```

## Serve It (Deno)

```ts
import router from "./router.ts"

Deno.serve((request) => router.fetch(request))
```

## Method Maps

You can provide per-method handlers in one route declaration.

```ts
router.route(c.chemin("posts"), {
	GET: ({ resp }) => resp.json([{ id: 1 }]),
	POST: ({ resp }) => resp(new Response(null, { status: 201 })),
})
```

## Next Steps

- Learn runtime mounting patterns in [Hosting And Runtimes](/guide/hosting-and-runtimes/).
- Learn the lifecycle model in [Core Concepts](/guide/core-concepts/).
- Learn control helpers in [Middleware](/guide/middleware/).
- Read all exports in [API Overview](/reference/api-overview/).

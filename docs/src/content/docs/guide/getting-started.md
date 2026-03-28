---
title: Getting Started
description: Install wooter, register routes, and serve requests through fetch.
sidebar:
    order: 1
---

wooter is runtime-agnostic. You define routes and call `fetch`.

## Install Or Import

### JSR (recommended)

```sh
deno add jsr:@bronti/wooter
```

### npm projects (via JSR CLI)

```sh
npx jsr add @bronti/wooter
```

### ESM URL via esm.sh

```ts
import { c, Wooter } from "https://esm.sh/jsr/@bronti/wooter"
```

## First Router

```ts
import { c, Wooter } from "@bronti/wooter"

const router = new Wooter()

router.route(c.chemin(), "GET", ({ resp }) => {
	resp(new Response("hello"))
})

router.route(c.chemin("posts", c.pNumber("id")), "GET", ({ params, resp }) => {
	resp.json({ postId: params.get("id") })
})

export default router
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

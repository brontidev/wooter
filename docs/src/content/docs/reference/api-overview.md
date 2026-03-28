---
title: API Overview
description: Public exports and package entry points.
---

## Main Package

`jsr:@bronti/wooter` exports:

- `Wooter`
- `c` (`chemin` helpers)
- `use` and `middleware`
- `Option`
- `Result`
- Error exports (`WooterError`, `ControlFlowBreak`, type guards, lifecycle errors)
- Response helpers (`makeRedirect`, `makeError`)
- Public TypeScript types

## Entry Points

From `deno.jsonc`:

- `.` -> main public API
- `./chemin`
- `./option`
- `./result`
- `./types`
- `./error`
- `./response`
- `./use`

## Primary Runtime Type

`Wooter<TData, TParentParams>` is the main typed router.

Core methods:

- `route(path, method, handler)`
- `route(path, methodMap)`
- `use(middleware)`
- `router(basePath)`
- `notFound(handler)`
- `fetch(request)`

## Utility Exports

Response helpers:

```ts
makeRedirect(location, init?)
makeError(status, message?, headers?)
```

Middleware helper:

```ts
middleware<TNextData>(handler)
```

Handler wrapper helper:

```ts
use(middlewareHandler, routeHandler)
```

For full API symbols and signatures, see the hosted API docs:
https://jsr.io/@bronti/wooter/doc

---
title: Core Concepts
description: Mental model for routing, response timing, and error boundaries.
sidebar:
  order: 3
---

## Structural Routing

wooter uses `chemin` route patterns, not string templates.

Example path idea:
`/admin/post/:postId/delete?`

Pattern form:

```ts
c.chemin("admin", "post", c.pNumber("postId"), c.pOptionalConst("delete"))
```

This makes parameter typing and optional segments explicit in the route definition.

## Two-Phase Lifecycle

wooter tracks two async states for each request:

- Handler execution state (did the handler finish successfully or fail)
- Response resolution state (did a response get resolved)

A handler must resolve exactly one response with `ctx.resp()` before handler completion. If no response is resolved in time, the request fails.

## Timing Defines Error Ownership

- Error before response resolution: belongs to request flow and rejects `router.fetch()`.
- Error after response resolution: no longer belongs to request flow and is treated as a stray error.

Stray errors are routed to the router `catchStrayErrors` sink. The default sink rethrows.

## Middleware Is Cooperative

Middleware is not just pre/post hooks. It is a chain that must be advanced intentionally.

- Continue with `.next()` or `.forward()`
- Or resolve a response and stop intentionally

A middleware that does neither drops the chain and causes a failure.

## Control Flow vs Errors

- Use thrown errors for uncertain external failures that middleware may need to interpret.
- Use `ctx.safeExit()` for controlled, internal early-exit logic after a response has already been set.

For library middleware, prefer `ctx.safeExit()` over throwing `ControlFlowBreak` directly.

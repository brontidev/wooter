---
title: Context Reference
description: RouteContext and MiddlewareContext behavior and methods.
---

## RouteContext

Route handlers receive `RouteContext`.

Properties:

- `request: Request`
- `url: URL`
- `params: TypedMap<...>`
- `data: ...`

Methods:

- `resp(response)` or `resp(body, init)`
- `resp.json(data, init?)`
- `safeExit()`

Lifecycle guarantees:

- `resp(...)` must be resolved exactly once.
- Calling `resp(...)` twice throws `HandlerRespondedTwiceError`.
- Exiting without a response fails with `HandlerDidntRespondError`.

## MiddlewareContext

Middleware handlers receive `MiddlewareContext` (extends `RouteContext`).

Methods:

- `next(data?, request?) -> Promise<Response>`
- `tryNext(data?, request?) -> Promise<Result<Response, unknown>>`
- `forward(data?, request?) -> Promise<Response>`
- `tryForward(data?, request?) -> Promise<Result<Response, unknown>>`

Semantics:

- `next` delegates and returns downstream response.
- `forward` delegates and responds with downstream response.
- `try*` variants return `Result` instead of throwing.

Middleware must either delegate (`next` or `forward`) or resolve a response.

## Data And Params Typing

- Route params are derived from `chemin` path pieces.
- Middleware data merges into `ctx.data` for downstream handlers.
- Nested routers preserve parent param typing.

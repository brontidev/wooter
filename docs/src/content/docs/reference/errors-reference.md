---
title: Errors Reference
description: Framework error types, stray errors, and control-flow boundaries.
---

## Exported Error Symbols And Types

- `WooterError`
- `ControlFlowBreak`
- `isWooterError(value)`
- `HandlerDidntRespondError`
- `HandlerRespondedTwiceError`
- `MiddlewareHandlerDidntCallUpError`

## Request-Lifecycle Errors

These reject `router.fetch()` when they occur before response resolution:

- `HandlerDidntRespondError`: handler exited without responding.
- `HandlerRespondedTwiceError`: handler attempted double response.
- `MiddlewareHandlerDidntCallUpError`: middleware exited without delegation/response.

## Stray Errors

If an error occurs after a response has already resolved, it is treated as stray and routed to `catchStrayErrors`.

Default `catchStrayErrors` behavior rethrows.

In production, provide a sink that logs and isolates these failures.

## `safeExit()` And `ControlFlowBreak`

`safeExit()` throws an internal control-flow signal (`ControlFlowBreak`) that is handled as a non-error execution stop.

Use cases:

- middleware-internal early stop after response
- controlled branches where no further handlers should run

Non-use cases:

- representing unknown runtime failures
- replacing normal error propagation

---
title: Control Flow
description: Understand safeExit, ControlFlowBreak, and timing-sensitive failures.
sidebar:
    order: 6
---

## `safeExit()`

`ctx.safeExit()` is an intentional control-flow stop. It should be used only after `ctx.resp(...)` has resolved the response.

```ts
resp(new Response("invalid", { status: 400 }))
safeExit()
```

This stops execution without surfacing a framework failure.

## Why Not Throw `ControlFlowBreak` Yourself

`ControlFlowBreak` is a symbol. In multi-instance module environments, symbol identity can differ across copies of a package.

`ctx.safeExit()` always throws the correct internal signal for the current router instance.

## Error Semantics

Errors and `safeExit()` are different tools:

- Throw errors for uncertain or external failures.
- Use `safeExit()` for controlled internal exits after setting a response.

## Stray Errors

If an async operation throws after response resolution, it cannot reject `router.fetch()` anymore. It is routed to
`catchStrayErrors`.

Default behavior rethrows stray errors, which can become unhandled rejections.

## Practical Checklist

- Call `ctx.resp()` exactly once.
- If you intentionally stop after responding, use `ctx.safeExit()`.
- Do not use `safeExit()` before resolving a response.
- Configure `catchStrayErrors` in production to avoid process crashes.

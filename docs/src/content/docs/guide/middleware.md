---
title: Middleware
description: Compose route behavior with next, forward, and Result-based flow.
sidebar:
  order: 4
---

## Middleware Context Methods

`MiddlewareContext` extends route context and adds:

- `.next(data?, request?)`: run downstream and return `Promise<Response>` or throw
- `.tryNext(data?, request?)`: run downstream and return `Promise<Result<Response, unknown>>`
- `.forward(data?, request?)`: run downstream and auto-call `ctx.resp(...)`
- `.tryForward(data?, request?)`: like forward, but returns `Result`

## Be Nice Rules

1. Do not drop the chain.
2. Do not hoard errors.

Dropping the chain means middleware exits without calling `.next()`/`.forward()` and without sending a response.

Hoarding errors means catching errors but not rethrowing when they are not actually handled.

## Pass Data Forward

```ts
import { middleware } from "@bronti/wooter"

const withRequestId = middleware<{ requestId: string }>(async (ctx) => {
	await ctx.forward({ requestId: crypto.randomUUID() })
})
```

Downstream handlers receive `ctx.data.requestId` with proper typing.

## Result-Based Control

```ts
const guard = middleware(async (ctx) => {
	const result = await ctx.tryNext({})
	result.inspectErr((e) => {
		console.error("downstream failed", e)
	})
	ctx.resp(result.match((r) => r, () => new Response("failed", { status: 500 })))
})
```

Use `try*` variants when middleware wants to inspect and branch on downstream failures.

## Safe Exit Pattern

```ts
import { makeError, middleware } from "@bronti/wooter"

const json = middleware<{ json: () => Promise<unknown> }>(async ({ request, resp, forward, safeExit }) => {
	let parsed: unknown
	await forward({
		json: async () => {
			if (parsed !== undefined) return parsed
			try {
				parsed = await request.clone().json()
				return parsed
			} catch {
				resp(makeError(400, "Invalid JSON"))
				safeExit()
			}
		},
	})
})
```

This keeps parsing logic centralized and avoids repetitive handler-level try/catch.

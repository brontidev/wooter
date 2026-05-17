# Wooter Philosophy

## Purpose

Wooter is a fetch-native routing and middleware framework designed around a small set of runtime guarantees and a large amount of implementation freedom.

The framework intentionally avoids prescribing a single application architecture. Users may prefer exceptions, Result types, helper functions, middleware-driven validation, route-local validation, or entirely custom abstractions. Wooter is designed to support these approaches rather than force one.

The framework's job is to ensure the request lifecycle remains valid. How users build on top of that lifecycle is largely their decision.

---

# Core Principle

Wooter is built around a single invariant:

> Every request must produce a response before the lifecycle completes.

This invariant drives nearly every design decision in the framework.

The framework does not care:

* How a response was created.
* Which handler created it.
* Whether exceptions or Result types were used.
* Whether middleware or routes handled errors.

The framework only cares that a valid response exists before execution ends.

Violations of this invariant are treated as framework errors.

---

# Response-First Lifecycle

Many web frameworks are route-first.

Wooter is response-first.

The lifecycle is considered successful when a response has been produced, not when a route handler returns.

Conceptually:

Request
↓
Middleware
↓
Route
↓
Response Produced
↓
Lifecycle Complete

The response may originate from:

* Middleware
* Route handlers
* Error handlers
* Helper abstractions

The framework does not distinguish between these sources.

---

# Happy Path Programming

Wooter encourages happy-path programming.

Handlers should primarily describe successful execution.

Example:

```ts
const body = await state.parseJson(schema)
const task = await doTask(body)

resp.json(task)
```

The handler focuses on useful work.

Error handling is typically moved elsewhere:

* Validation middleware
* Authentication middleware
* Error translation middleware
* Helper wrappers

This reduces repetitive checks and keeps route logic focused.

This is an encouragement, not a requirement.

Users are free to perform validation and error handling directly inside routes.

---

# Middleware Owns Cross-Cutting Concerns

Middleware exists to handle behavior that would otherwise be duplicated.

Examples:

* Authentication
* Authorization
* Validation
* Request parsing
* Logging
* Error translation
* Metrics
* Helper injection

The preferred approach is:

1. Middleware performs setup.
2. Middleware extends state.
3. Route handlers consume prepared state.

Example:

```ts
const body = await state.parseJson(schema)
```

The route should not need to know how JSON parsing or validation was implemented.

---

# State Accumulates

State is additive.

Each middleware may contribute additional properties.

Example:

```ts
app
    .use(auth)
    .use(json)
    .use(validation)
```

A downstream handler may receive:

```ts
state.user
state.json
state.parseJson
```

Middleware should generally add capabilities rather than replace existing state.

The state object represents the accumulated knowledge and utilities available at the current point in the lifecycle.

---

# Explicit Response Propagation

Unlike many middleware systems, responses are propagated explicitly.

Middleware must either:

* Produce a response itself.
* Or propagate a response from downstream.

This behavior is intentional.

Response ownership should remain visible and explicit.

The framework avoids hidden response propagation.

---

# next() vs forward()

Wooter provides two primary ways to continue execution.

## forward()

Use when middleware only provides state or helpers.

Example:

```ts
await forward({
    parseJson,
})
```

The middleware contributes capabilities and forwards execution.

It does not need access to the response.

## next()

Use when middleware intends to inspect, modify, replace, or wrap the downstream response.

Example:

```ts
const response = await next()

resp(modify(response))
```

If middleware does not need the response, prefer `forward()`.

This communicates intent more clearly.

---

# Exception Philosophy

Wooter treats exceptions differently depending on where they exist.

Inside the request lifecycle, exceptions are considered a legitimate tool for control flow and error propagation.

Outside the request lifecycle, unhandled exceptions are considered fatal application errors.

This distinction is fundamental to the framework.

---

# Exceptions Inside The Lifecycle

Within middleware and route execution, exceptions are encouraged as a mechanism for keeping code focused on the happy path.

Example:

```ts
const body = await state.parseJson(schema)
const task = await doTask(body)

resp.json(task)
```

The handler describes successful execution.

Failures may be handled elsewhere:

* Middleware
* Helper abstractions
* Error translation layers
* Route-local catch blocks

This allows handlers to remain concise without repeatedly checking for every possible failure.

The framework views exceptions as a transport mechanism for propagating failures to the layer best equipped to handle them.

---

# Middleware Is The Preferred Error Boundary

Middleware is the preferred location for reusable exception handling.

For example:

```ts
TaskFailedError
```

may be converted into:

```ts
500 Failed doing task
```

by middleware.

This prevents the same error handling logic from being repeated throughout the application.

The framework encourages handling expected failures near the boundaries of the lifecycle rather than inside every route.

---

# Result Types and Exceptions

Wooter supports both styles.

Users may:

```ts
await next()
```

or

```ts
await tryNext()
```

depending on preference.

The framework does not prefer one approach internally.

Result-based APIs exist for users who prefer explicit error channels.

Exception-based APIs exist for users who prefer exception propagation.

Users should choose the approach that best fits their application.

However, users should avoid consuming Result errors without handling them, as doing so can accidentally swallow failures that would otherwise propagate correctly.

---

# Exceptions That Reach The Top Level

If an exception escapes the entire request lifecycle, Wooter assumes something went wrong.

An uncaught exception at the top level indicates one of two situations:

1. The error was expected but was never handled.
2. The error was unexpected and represents a bug.

In both cases the lifecycle failed to resolve the exception appropriately.

For this reason, unhandled top-level exceptions are treated as fatal by default.

The optional global error callback exists as a last-resort mechanism, not as the primary error handling strategy.

Expected failures should generally be handled before reaching the top level.

---

# Control Flow Signals

Not every thrown value represents an error.

Some values exist purely to control execution.

The most notable example is:

```ts
safeExit()
```

which throws an internal sentinel value named:

```ts
ControlFlowBreak
```

This does not indicate failure.

Its meaning is:

> The request has already been handled. Stop executing immediately.

The framework consumes this signal internally once a response exists.

This allows middleware and helpers to terminate execution without introducing additional return-value checks.

Example:

```ts
resp("Invalid JSON", { status: 400 })
safeExit()
```

Execution stops immediately.

No additional code runs.

No error occurred.

The request simply completed early.

Calling `safeExit()` before a response exists is a lifecycle violation and is treated as a framework error.

---

# Control Flow Through Exceptions

Wooter intentionally uses exceptions as a transport mechanism for certain lifecycle operations.

This design is inspired by systems that use exceptions for non-local control flow.

Examples include:

* Redirect handling in SvelteKit
* Cancellation signals in async runtimes
* Internal framework control-flow exceptions in many web frameworks

The important distinction is that these exceptions are not failures.

They are lifecycle signals.

---

# Framework-Owned Exceptions

Some thrown values belong to the framework itself.

Examples include:

* ControlFlowBreak
* Internal lifecycle exceptions
* Other runtime-managed signals

Application code should generally not consume these values.

If code catches arbitrary exceptions, framework-owned exceptions should be rethrown.

Use:

```ts
isWooterError(error)
```

to identify framework-managed values.

Example:

```ts
try {
    await doSomething()
} catch (error) {
    if (isWooterError(error)) {
        throw error
    }

    // application-specific handling
}
```

This ensures the lifecycle can continue operating correctly.

---

# Failure vs Control Flow

A useful mental model is:

Application errors:

```ts
ValidationError
TaskFailedError
DatabaseError
```

represent failures.

Framework signals:

```ts
ControlFlowBreak
```

represent lifecycle control flow.

Both may travel through the exception system.

Only one category represents an actual error.

The framework intentionally uses the same transport mechanism for both because it allows execution to unwind cleanly while preserving happy-path code.

---

# Routing Philosophy

Wooter uses Chemin for path matching and parameter extraction.

Routing should be:

* Type-safe
* Explicit
* Composable

Chemin is exposed directly because path definitions are considered a core part of application structure.

Users should not need to learn a proprietary routing syntax unique to Wooter.

---

# Fetch-Native Design

Wooter is built around modern web standards.

Core primitives include:

* Request
* Response
* fetch()

The framework intentionally avoids introducing replacements for these APIs.

This allows applications to remain portable across runtimes.

Examples:

* Deno
* Bun
* Node.js
* Cloudflare Workers
* Other Fetch-compatible environments

The framework should feel like an extension of the Web Platform rather than an abstraction over it.

---

# Design Priorities

When evaluating new features, prioritize:

1. Lifecycle correctness.
2. Explicit behavior.
3. Happy-path ergonomics.
4. Type safety.
5. Runtime portability.
6. User freedom.

Avoid adding features that:

* Hide lifecycle behavior.
* Restrict architectural choices.
* Force a single error-handling style.
* Replace existing web standards without strong justification.

Wooter should remain a developer tool, not an application architecture.

The framework's responsibility is to provide reliable lifecycle primitives.

Application design belongs to the user.

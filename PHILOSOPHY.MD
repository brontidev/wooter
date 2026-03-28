This router differs from traditional JavaScript routers in two major ways: its route definition system and its response lifecycle.

For routing, instead of string-based paths, it uses a pattern builder called `chemin`. Routes are defined structurally rather than
as strings. For example, a route like `/admin/post/:postId/delete?` would be defined as:

```js
chemin(
	"admin",
	"post",
	pNumber("postId"),
	pOptionalConst("delete"),
)
```

This approach avoids ambiguity and enables type-safe parameter definitions. However, it also means this router does not behave
like Express-style routers, and assumptions about string matching or route ordering do not apply.

The more important distinction is the response lifecycle. Internally, the router separates handler execution from response
resolution. These are tracked as two independent asynchronous phases (implemented using a custom promise-like wrapper called
`Soon`). One resolves when the handler finishes executing, and the other resolves when a response is provided.

A response must be resolved exactly once using `ctx.resp()` before the handler completes execution. If `ctx.resp()` is not called
in time (for example, inside a delayed callback that runs after the handler returns), the response will not be properly associated
with the request. Because of this, asynchronous work must always be awaited before calling `ctx.resp()`, or manually wrapped in a
promise and awaited.

Error handling depends entirely on timing relative to the response lifecycle. If an error occurs before a response is resolved, it
bubbles up to the `.fetch()` call, causing the returned promise to reject. If an error occurs after a response has already been
resolved, it can no longer propagate through the request lifecycle and is instead sent to a `catchStrayErrors` handler defined in
the router options. By default, this handler simply rethrows the error, which can result in an unhandled promise rejection and
crash the application. This distinction is critical: errors before a response belong to the request, while errors after a response
are considered “stray.”

Middleware operates as a cooperative pipeline and is designed to “be nice” to other handlers. This means two rules must always be
followed: middleware must not drop the chain, and it must not hoard errors. Dropping the chain occurs when a middleware neither
continues execution (via `.next()` or `.forward()`) nor resolves a response with `ctx.resp()`, leaving the request in an
unresolved state. Hoarding errors refers to catching errors without rethrowing them when they are not explicitly handled. This is
especially important because errors are sometimes used intentionally as control flow signals by other parts of the system.

Middleware provides several control flow methods. `.next()` executes the next handler and returns a promise resolving to the
response, while `.forward()` does the same but automatically passes the result into `ctx.resp()`. The `try` variants (`.tryNext()`
and `.tryForward()`) return a `Result` object instead of throwing, allowing middleware to selectively handle errors. Middleware
can also pass data forward by providing an object to `.next()` or `.forward()`, which is merged into a shared context object
accessible by subsequent handlers.

In addition to standard error propagation, this router supports explicit control flow interruption using a special internal symbol
called `ControlFlowBreak`. This can be triggered via `ctx.safeExit()`, which throws the symbol internally and is silently handled
by the router to stop execution immediately. This is intended for controlled, internal logic where the developer knows that
execution should stop after a response has been resolved. It must only be used after calling `ctx.resp()`, otherwise it results in
a dropped chain.

Errors and `safeExit()` serve different purposes and should not be mixed. Errors are meant for situations involving external or
uncontrolled code, where the outcome is not guaranteed and should be interpreted by middleware. In contrast, `safeExit()` is for
controlled, internal logic where the developer has already determined the correct response and simply needs to stop execution. A
good example of this is middleware that wraps request parsing logic.

For instance, a JSON middleware can expose a helper like `ctx.data.json()` that parses the request body once and caches the
result. If parsing fails, it can immediately respond with a `400 Invalid JSON` error and call `safeExit()` to stop execution. This
avoids the need for repetitive try/catch blocks in every route handler. Because this middleware fully controls the logic it
introduces, it is safe to use `safeExit()` instead of throwing errors.

When writing middleware libraries, it is strongly recommended to use `ctx.safeExit()` rather than throwing `ControlFlowBreak`
directly. Since `ControlFlowBreak` is a symbol, its identity depends on the specific module instance. In environments like Deno or
complex ESM setups, multiple instances of the same library can exist, resulting in different symbol identities that do not match.
Using `ctx.safeExit()` ensures the correct internal signal is always used, avoiding subtle and hard-to-debug issues.

Overall, this router is designed around explicit lifecycle control, cooperative middleware, and clear separation between execution
and response resolution. It requires a different mental model than traditional routers, emphasizing structured routing,
timing-aware responses, and intentional control flow.

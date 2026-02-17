# Control-Flow Throws After Response

## Overview

When building middleware in Wooter, it's common to respond to a request and then throw a value to break out of the current execution flow without continuing to the next handler. This pattern is particularly useful in validation and parsing middleware.

## The Pattern

```typescript
const parseJson = middleware<{ json: () => Promise<any> }>(
  async ({ request, resp, expectAndRespond }) => {
    let _json: any
    await expectAndRespond({
      json: async () => {
        if (_json) return _json
        try {
          return _json = await request.clone().json()
        } catch (e) {
          // Respond with error
          resp(new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 }))
          // Throw to break control flow (not a real error)
          throw 0
        }
      },
    })
  }
)
```

## How It Works

1. **Response First**: The middleware calls `resp()` to send a response to the client
2. **Control-Flow Throw**: After responding, it throws a primitive value (like `0`, `undefined`, or a string) to exit the function
3. **No Propagation**: Wooter recognizes this as a control-flow throw (not a real error) and does NOT propagate it upward

## What Gets Silenced

After a response has been sent (`resp()` was called), the following throws are silently ignored:

- **Primitive values**: `throw 0`, `throw "error"`, `throw null`, `throw undefined`
- **Non-Error objects**: Any thrown value that is not an `instanceof Error`

## What Still Surfaces

Even after a response is sent, the following are still logged to the console:

- **Error instances**: `throw new Error("bug")` - These indicate real bugs and are logged via `console.error()`

## Why This Matters

Before this fix, throwing after `resp()` would:
1. Be treated as a real handler error
2. Potentially crash the application
3. Surface as unhandled rejection errors

Now, these control-flow throws are recognized as intentional and handled gracefully.

## Best Practices

1. **Use primitive values for control flow**: When you just want to exit after responding, use `throw 0` or similar primitives
2. **Use Error instances for real bugs**: If you discover an actual error condition, throw a proper `Error` instance
3. **Respond before throwing**: Always call `resp()` before your control-flow throw
4. **Document your intent**: Add a comment explaining why you're throwing (e.g., `// Exit after responding`)

## Examples

### ✅ Good: Control-Flow Throw

```typescript
resp(new Response("Unauthorized", { status: 401 }))
throw 0  // Exit control flow - this will be silently ignored
```

### ✅ Good: Real Error After Response

```typescript
resp(new Response("OK"))
throw new Error("Unexpected state")  // This will be logged to console
```

### ❌ Bad: Complex Error Object for Control Flow

```typescript
resp(new Response("Bad Request", { status: 400 }))
throw new Error("Validation failed")  // Wasteful - use primitive instead
```

### ✅ Better: Simple Primitive for Control Flow

```typescript
resp(new Response("Bad Request", { status: 400 }))
throw 0  // Clean and clear intent
```

## Testing

The `tests/control-flow-throws.test.ts` file contains comprehensive tests for this behavior, including:

- Primitive number throws (`throw 0`)
- String throws (`throw "error"`)
- Undefined throws (`throw undefined`)
- Error instances after response

These tests verify that the application doesn't crash and responses are sent correctly.

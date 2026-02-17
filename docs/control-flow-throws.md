# Control-Flow Breaks After Response

## Overview

When building middleware in Wooter, you may need to respond to a request and then immediately exit the current execution flow without continuing to the next handler. This pattern is particularly useful in validation and parsing middleware.

Wooter provides the `ControlFlowBreak` symbol for this purpose.

## The Pattern

```typescript
import { ControlFlowBreak, middleware } from "@@/index.ts"

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
          // Exit cleanly using ControlFlowBreak
          throw ControlFlowBreak
        }
      },
    })
  }
)
```

## How It Works

1. **Response First**: The middleware calls `resp()` to send a response to the client
2. **Control-Flow Break**: After responding, it throws `ControlFlowBreak` to exit the function
3. **No Propagation**: Wooter recognizes `ControlFlowBreak` as an intentional exit (not a real error) and does NOT propagate it upward

## What Is ControlFlowBreak?

`ControlFlowBreak` is a unique Symbol exported by Wooter:

```typescript
export const ControlFlowBreak = Symbol("ControlFlowBreak")
```

Using a Symbol ensures that only intentional control-flow breaks are silenced, not accidental errors.

## What Gets Silenced

After a response has been sent (`resp()` was called), throwing `ControlFlowBreak` is silently ignored and treated as successful execution.

## What Still Propagates

Everything else still propagates normally:

- **Error instances**: `throw new Error("bug")` - These indicate real bugs
- **Primitive values**: `throw 0`, `throw "error"`, `throw null` - These are not ControlFlowBreak
- **Any other value**: Only `ControlFlowBreak` is special

## Why This Matters

Before this feature, throwing after `resp()` would:
1. Be treated as a real handler error
2. Potentially crash the application or surface as unhandled rejection
3. Make middleware patterns like parseJson difficult to implement correctly

Now, using `ControlFlowBreak` makes the intent explicit and handles it gracefully.

## Best Practices

### ✅ Good: Use ControlFlowBreak

```typescript
import { ControlFlowBreak } from "@@/index.ts"

resp(new Response("Unauthorized", { status: 401 }))
throw ControlFlowBreak  // Clear intent, properly handled
```

### ✅ Good: Real Errors Still Work

```typescript
resp(new Response("OK"))
throw new Error("Unexpected state")  // Real error, will be logged
```

### ❌ Bad: Using Primitives for Control Flow

```typescript
resp(new Response("Bad Request", { status: 400 }))
throw 0  // Unclear intent, will propagate as error
```

### ❌ Bad: Not Throwing at All

```typescript
resp(new Response("Unauthorized", { status: 401 }))
return  // Handler continues executing, may cause issues
```

## Migration from Old Pattern

If you were using primitive throws for control flow:

```typescript
// Old pattern (no longer recommended)
resp(new Response("Error", { status: 400 }))
throw 0
```

Update to:

```typescript
// New pattern (recommended)
import { ControlFlowBreak } from "@@/index.ts"

resp(new Response("Error", { status: 400 }))
throw ControlFlowBreak
```

## Testing

The `tests/control-flow-throws.test.ts` file contains comprehensive tests for this behavior, including:

- `ControlFlowBreak` after response is silenced ✅
- Real Error instances after response still propagate ✅
- Primitive values after response still propagate (not silenced) ✅
- Multiple `ControlFlowBreak` throws work correctly ✅

These tests verify that the application doesn't crash and responses are sent correctly.

## Example: Authentication Middleware

```typescript
import { ControlFlowBreak, middleware } from "@@/index.ts"

const auth = middleware<{ user: User | null }>(
  async ({ request, resp, expectAndRespond }) => {
    await expectAndRespond({
      user: async () => {
        const token = request.headers.get("Authorization")
        if (!token) {
          resp(new Response("Unauthorized", { status: 401 }))
          throw ControlFlowBreak
        }
        return await verifyToken(token)
      },
    })
  }
)
```

## Example: Validation Middleware

```typescript
import { ControlFlowBreak, middleware } from "@@/index.ts"

const validateBody = middleware<{ body: ValidatedData }>(
  async ({ request, resp, expectAndRespond }) => {
    await expectAndRespond({
      body: async () => {
        const data = await request.json()
        const result = schema.safeParse(data)
        if (!result.success) {
          resp(Response.json({ errors: result.error.issues }, { status: 400 }))
          throw ControlFlowBreak
        }
        return result.data
      },
    })
  }
)
```

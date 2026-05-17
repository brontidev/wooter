---
title: Installation
---

# Installation

Wooter is published to [JSR](https://jsr.io/@bronti/wooter), the JavaScript Registry. Install using your preferred package manager.

## Deno

```bash
deno add @bronti/wooter
```

## Node.js

```bash
npx jsr add @bronti/wooter
```

## Bun

```bash
bunx jsr add @dldc/chemin
```

## Yarn

```bash
yarn add jsr:@dldc/chemin
```

## pnpm

```bash
pnpm i jsr:@dldc/chemin
```

## CDN/Direct Import

For browser or direct URL imports, use a CDN that supports JSR:

### esm.sh

```ts
import { Wooter, c } from "https://esm.sh/jsr/@bronti/wooter"
```
## Verify Installation

Create a test file to verify installation:

```ts
import { Wooter, c } from "@bronti/wooter"

const app = new Wooter()
  .route(c.chemin(), "GET", ({ resp }) => {
    resp(new Response("Hello, Wooter!"))
  })

export default app
```

## What's Included

The main `@bronti/wooter` export includes:

- **Wooter** — Main router class
- **c** — Chemin path builder for type-safe routes
- **middleware** — Helper for declaring middleware
- **use** — Function to wrap middleware + route handlers
- **Result, Option** — Utility types for error handling
- **Response helpers** — `makeRedirect()`, `makeError()`
- **Error types** — `WooterError`, `ControlFlowBreak`, etc.

### Modular Exports

Wooter also provides focused exports for specific concerns:

```ts
// Main export
import { Wooter, c, middleware } from "@bronti/wooter"

// Specific exports
import * as c from "@bronti/wooter/chemin"           // Chemin routing
import { Option, some, none } from "@bronti/wooter/option"  // Option type
import { Result, ok, err } from "@bronti/wooter/result"     // Result type
import { WooterError } from "@bronti/wooter/error"          // Errors
import { makeError, makeRedirect } from "@bronti/wooter/response" // Response helpers
```

## Runtime Requirements

Wooter requires any runtime that implements the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API):

- ✅ Deno 1.20+
- ✅ Node.js 18+
- ✅ Bun 0.1.0+
- ✅ Cloudflare Workers
- ✅ Deno Deploy
- ✅ Fastly Compute
- ✅ Most modern edge runtimes
- ✅ Modern browsers (with limitations)

## Next Steps

- **[Quick Start](./quick-start.md)** — Build your first router
- **[Core Concepts](./core-concepts.md)** — Understand the framework
- **[Examples](./examples/basic-routes.md)** — See real code

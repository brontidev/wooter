---
title: Option & Result Types
---

# Option & Result Types

Wooter includes `Option` and `Result` types for functional error handling.

These types are inspired by Rust and provide a more explicit, composable alternative to exceptions.

## Option — Handle Missing Values

`Option<T>` represents a value that may or may not be present.

### Creating Options

```ts
import { Option, some, none } from "@bronti/wooter"

const found: Option<string> = some("value")
const notFound: Option<string> = none()
```

### Checking for Presence

```ts
const opt = some(42)

// Using match()
opt.match(
  (value) => console.log(value),  // 42
  () => console.log("not found")
)

// Using if
if (opt.isSome()) {
  console.log(opt.unwrap())
}

if (opt.isNone()) {
  console.log("no value")
}
```

### Unwrapping Values

```ts
const opt = some(42)

// Unwrap (throws if none)
const value = opt.unwrap()  // 42

// Unwrap with default
const valueOrDefault = opt.unwrapOr(0)  // 42

// Unwrap or compute default
const computed = opt.unwrapOrElse(() => 0)  // 42
```

### Transforming Options

```ts
const opt = some(5)

// Map
const doubled = opt.map((n) => n * 2)  // some(10)

// Map or default
const result = opt.mapOr(0, (n) => n * 2)  // 10

// Chain operations
const opt2 = opt
  .map((n) => n * 2)       // some(10)
  .map((n) => n + 5)       // some(15)
  .filter((n) => n > 10)   // some(15)
```

### Filtering

```ts
const opt = some(15)

const filtered = opt.filter((n) => n > 10)  // some(15)
const notFiltered = opt.filter((n) => n > 20)  // none()
```

### Using with Params

Wooter's route params can be converted to Options:

```ts
import { Option } from "@bronti/wooter"

app.route(c.chemin("users", c.pString("id")), "GET", async ({ params, resp }) => {
  const id = Option.from(params.get("id"))
    .filter((id) => id !== "")
    .map((id) => parseInt(id))
    .match(
      (userId) => Response.json({ userId }),
      () => new Response("Invalid ID", { status: 400 })
    )
  
  resp(id)
})
```

## Result — Handle Errors

`Result<T, E>` represents either a success (`ok`) or failure (`err`).

### Creating Results

```ts
import { Result, ok, err } from "@bronti/wooter"

const success: Result<number, string> = ok(42)
const failure: Result<number, string> = err("Something failed")
```

### Checking Success/Failure

```ts
const result = ok(42)

// Using match()
result.match(
  (value) => console.log(value),      // 42
  (error) => console.log(error)
)

// Using if
if (result.isOk()) {
  console.log(result.unwrap())
}

if (result.isErr()) {
  console.log(result.unwrapErr())
}
```

### Unwrapping Results

```ts
const result = ok(42)

// Unwrap success (throws if error)
const value = result.unwrap()  // 42

// Unwrap error
const error = result.unwrapErr()  // throws if ok

// Unwrap or default
const valueOrDefault = result.unwrapOr(0)  // 42
```

### Transforming Results

```ts
const result = ok(5)

// Map success
const mapped = result.map((n) => n * 2)  // ok(10)

// Map error
const errorMapped = result.mapErr((e) => `Error: ${e}`)

// Chain operations
const result2 = result
  .map((n) => n * 2)           // ok(10)
  .map((n) => n + 5)           // ok(15)
  .filter((n) => n > 10)       // ok(15) or err(...)
```

### Error Handling in Middleware

Use `tryNext()` with Result:

```ts
import { tryNext } from "@bronti/wooter"

const errorHandler = middleware(async ({ tryNext, resp }) => {
  const result = await tryNext()
  
  result.match(
    (response) => resp(response),
    (error) => {
      console.error(error)
      resp(new Response("Error", { status: 500 }))
    }
  )
})
```

### Converting Between Result and Option

```ts
const result: Result<number, string> = ok(42)

// Result to Option
const opt = result.ok()  // some(42)

// Option to Result
const opt2 = some(42)
const res = opt2.okOr("no value")  // ok(42)
```

## When to Use Each

### Use Option When

- Value may be present or absent
- No error information needed
- Examples: finding a user, checking a header

```ts
const user = getUser(id)  // Option<User>
const token = request.headers.get("Authorization")  // string | null (convert to Option)
```

### Use Result When

- Operation can fail with an error
- Error information is important
- Need to chain operations with error propagation

```ts
const result = validateInput(data)  // Result<ValidData, ValidationError>
const parsed = tryParse(json)  // Result<Data, ParseError>
```

### Use Exception Handling When

- Using external libraries that throw
- Simple synchronous operations
- Building on top of Option/Result

## Practical Examples

### Validating Route Parameters

```ts
import { Option } from "@bronti/wooter"

app.route(c.chemin("posts", c.pNumber("id")), "GET", async ({ params, resp }) => {
  const post = Option.from(params.get("id"))
    .flatMap((id) => findPost(id))  // Option<Post>
    .match(
      (post) => Response.json(post),
      () => new Response("Not found", { status: 404 })
    )
  
  resp(post)
})
```

### Parsing JSON with Results

```ts
import { Result, ok, err } from "@bronti/wooter"

const parseBody = (request: Request): Promise<Result<any, string>> => {
  return request.json()
    .then((data) => ok(data))
    .catch((e) => err(e.message))
}

app.route(c.chemin("users"), "POST", async ({ request, resp }) => {
  const result = await parseBody(request)
  
  const response = result.match(
    (body) => Response.json(body, { status: 201 }),
    (error) => new Response(error, { status: 400 })
  )
  
  resp(response)
})
```

### Chaining Operations

```ts
import { Result, ok, err } from "@bronti/wooter"

const getUser = (id: number): Result<User, string> => {
  const user = db.findUser(id)
  return user ? ok(user) : err(`User ${id} not found`)
}

const result = getUser(123)
  .map((user) => user.email)
  .flatMap((email) => validateEmail(email))
  .match(
    (valid) => console.log(`Valid: ${valid}`),
    (error) => console.log(`Error: ${error}`)
  )
```

### Optional Chaining

```ts
import { Option, some, none } from "@bronti/wooter"

const user = some({ name: "Alice", profile: { bio: "..." } })

const bio = user
  .flatMap((u) => Option.from(u.profile))
  .flatMap((p) => Option.from(p.bio))
  .unwrapOr("No bio")
```

## Comparison to Alternatives

### Option vs Optional Chaining

```ts
// Optional chaining (native)
const value = obj?.prop?.nested

// Option (explicit)
const value = Option.from(obj)
  .flatMap((o) => Option.from(o.prop))
  .flatMap((p) => Option.from(p.nested))
  .unwrap()
```

Optional chaining is simpler for basic cases. Use Option when you need transformation and explicit handling.

### Result vs try/catch

```ts
// try/catch
try {
  const value = riskyOperation()
  process(value)
} catch (error) {
  handleError(error)
}

// Result
riskyOperation()
  .match(
    (value) => process(value),
    (error) => handleError(error)
  )
```

Both are valid. Choose based on your codebase style. Wooter works with both.

## API Reference

### Option

- `.isSome()` / `.isNone()` — Check presence
- `.unwrap()` — Get value or throw
- `.unwrapOr(defaultValue)` — Get value or default
- `.unwrapOrElse(fn)` — Get value or compute default
- `.map(fn)` — Transform value
- `.flatMap(fn)` — Chain operations (returns Option)
- `.filter(fn)` — Filter by predicate
- `.match(onSome, onNone)` — Pattern match
- `.okOr(error)` — Convert to Result

### Result

- `.isOk()` / `.isErr()` — Check success/failure
- `.unwrap()` — Get value or throw
- `.unwrapErr()` — Get error or throw
- `.unwrapOr(defaultValue)` — Get value or default
- `.unwrapOrElse(fn)` — Get value or compute default
- `.map(fn)` — Transform value
- `.mapErr(fn)` — Transform error
- `.flatMap(fn)` — Chain operations (returns Result)
- `.filter(fn)` — Filter by predicate
- `.match(onOk, onErr)` — Pattern match
- `.ok()` — Convert to Option

## Next Steps

- **[Middleware](../middleware.md)** — Using Results in middleware
- **[Control Flow](../control-flow.md)** — tryNext() returns Results
- **[Error Handling Examples](../examples/error-handling.md)** — Real patterns

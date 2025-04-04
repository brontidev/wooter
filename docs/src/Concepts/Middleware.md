# Middleware & Data

Middleware is used to modify certain aspects of the request or response. They
can be used for many purposes, such as running checks on the request, providing
new utility functions, implementing error handling, or even modifying the
response itself.

To create a Midddlware, you can use the `.use` method on the Wooter instance.
Middleware functions are passed a new
[`MiddlewareEvent`](https://jsr.io/@bronti/wooter/doc/~/MiddlewareEvent) that
extends the [`RouteEvent`](https://jsr.io/@bronti/wooter/doc/~/RouteEvent), they
can use the basic `resp` and `err` functions, as well as the `up` function to
call the next middleware or route.

<!-- deno-fmt-ignore -->
> [!NOTE]
> `.use` modifies the Wooter, you do not need to do all of your `.use`
> calls in one line, but it is recommended if you want to keep type-safety.

```ts
$:import { Wooter, c } from "jsr:@bronti/wooter"
const app = new Wooter()
  .use<
		{ setTestHeader: (value: string) => void }
	>(async ({ up, resp }) => {
		let header: string | undefined
		// Go do the next thing in the stack, await it's response promise
		const response = await up({
			setTestHeader: (value) => {
				header = value
			},
		})
		if (header) response.headers.set("X-Test", header)
		resp(response)
	})

app.route.GET(c.chemin(), async ({ resp, data: { setTestHeader } }) => {
  setTestHeader("Hello, World!")
  resp(new Response("HI"))
})
$:export default app;
```

By default, if `up` is called, and `resp` isn't, the router will assume that
whatever `up` returned, is the response.

# Catching Errors

By default, errors are caught by the router and will result in a `500` response.
Since the `up` doesn't catch errors from the respective handler, Middleware can
catch errors and handle them before they reach the router.

```ts
$:import { Wooter, c } from "jsr:@bronti/wooter"
const app = new Wooter()
  .use(async ({ up, resp, err }) => {
    try {
      await up()
    } catch(e) {
      if(e instanceof DatabaseError) {
        resp(new Response("Database Error", { status: 500 }))
      } else {
        // We have no idea where this error came from, so we'll just rethrow it.
        err(e)
      }
    }
	})

app.route.GET(c.chemin(), async ({ resp }) => {
  const db_response = await db.unsafe_stuff()
  const result = db_response.map(v => v * 2)
  resp(Response.json(result))
})
$:export default app;
```

# `notFound` Handler

The `notFound` Handler is a special handler that is called when no route is
found. It is set using `.notFound`

```ts
$:import { Wooter, c } from "jsr:@bronti/wooter"
$:const app = new Wooter()
app.notFound(({ resp }) => {
	resp(new Response("Custom Not Found", { status: 404 }))
})
$:export default app;
```

# Standalone Middleware

The `StandaloneMiddleware` type allows for creating typed middleware without the
context of the `.use` function. This is useful for creating middleware
libraries.

```ts
// Real Example: https://github.com/is-a-thing/.github/blob/main/api/util/middleware/auth.ts
import { StandaloneMiddlewareHandler } from '@bronti/wooter/types'
$:import {
$:	createSessionCookie,
$:	deleteSessionCookie,
$:	validateSessionToken,
$:} from '$auth/index.ts'
$:import { AuthPair } from '$auth/index.ts'
$:import { Cookies } from '$util/middleware/cookies.ts'
$:import { None, Option } from '@oxi/option'
$:import { errorResponse } from '@bronti/wooter/util'

export const useAuth: StandaloneMiddlewareHandler<
// ⬇️ The data that this middleware adds
	{ auth: Option<AuthPair>; ensureAuth: () => AuthPair },
// ⬇️ The data that this middleware needs (this middleware depends on a `useCookies` middleware)
	{ cookies: Cookies }
> = async ({ data: { cookies }, up, resp }) => {
$:	const token = cookies.get('session') ?? null
$:	let auth: Option<AuthPair> = None
$:	if (token) {
$:		const pairOption = await validateSessionToken(token)
$:
$:		if (pairOption.isSome()) {
$:			// Token exists and is valid; update cookie and set auth
$:			createSessionCookie(token, cookies)
$:			auth = pairOption
$:		} else {
$:			// Token exists but is not valid; remove it
$:			deleteSessionCookie(cookies)
$:		}
$:	}
$:
	await up({
		auth,
		ensureAuth: () => {
			if (auth.isNone()) {
				throw resp(errorResponse(401, 'Unauthorized'))
			}
			return auth.unwrap()
		},
	})
}
```

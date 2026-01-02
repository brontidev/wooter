// @ts-nocheck: This is a file demo-ing an API that doesn't exist yet

const wooter = new Wooter()

/*
# MiddlewareContext (extends RouteContext)


## basic functions
.next(data?): Promise<Option<Response>> -> starts running the next handler, resolves with the response
^ next handler might still be running after this has already resolved

.block(): Promise<Result<null, unknown>> -> called after .next(), resolves when the next handler is completely done running
^ this will resolve after the handler resolves




## combinatory? functions
.pass(data?): Promise<Option<Response>> -> runs .resp(.next()), await and returning the response
equivalent to await ctx.next().andThen(r => ctx.resp(r))

^ next handler might still be running after this has already resolved

.unwrap(data?): Promise<Response> -> runs .next(data) & .block(), re-throwing any errors or just returning the result

equivalent to
```ts
await ctx.next().unwrapOrElse(async () => await ctx.block().unwrap())
```


.unwrapResp(data?): Promise<Response> -> runs .pass(data) & .block(), re-throwing any errors or just returning the result


equivalent to
```ts
await ctx.pass().unwrapOrElse(async () => await ctx.block().unwrap())
```

or
```ts
await ctx.next().andThen(r => ctx.resp(r)).unwrapOrElse(async () => await ctx.block().unwrap())
```


Compared to v2, it is now required to call .resp() for the response to be sent upwards
*/

const middleware = async (ctx) => {
	const response = await ctx.unwrapResp()

	logger.logRequest(ctx.request, response)
}

const middleware = async (ctx) => {
	try {
		await ctx.unwrapResp()
	} catch (error) {
		if (isWooterError(error)) throw error
		if (isDbError(error)) {
			ctx.resp(
				new Response("An error occured in the database", {
					status: 500,
				}),
			)
		}
		// we couldn't handle this error, it must be critical
		logger.logError(error)
		throw error
	}
}

import { parse, type ParseOptions, serialize, type SerializeOptions } from "npm:cookie"

const middleware = async ({ request, resp, next, pass, block }) => {
	const cookieHeader = request.headers.get("cookie") || ""
	const parsedCookies = parse(cookieHeader)
	const cookieMap: Record<
		string,
		{ value: string; opts?: Partial<SerializeOptions> }
	> = {}

	const cookies = {
		get: (name: string) => cookieMap[name].value ?? parsedCookies[name],
		getAll: () =>
			Object.fromEntries(
				Object.entries(parsedCookies).concat(
					Object.entries(cookieMap).map(([name, { value }]) => {
						return [name, value]
					}),
				),
			),
		delete: (name: string) => {
			cookieMap[name] = { value: "", opts: { maxAge: 0 } }
		},
		set: (
			name: string,
			value: string,
			options?: Partial<SerializeOptions>,
		) => {
			cookieMap[name] = { value, opts: options }
		},
	}

	const response = await unwrap({ cookies })

	const newCookies = Object.entries(cookieMap)
		.map(([name, cookie]) =>
			serialize(name, cookie.value || "", {
				...cookie.opts,
				httpOnly: true,
				secure: true,
			})
		)

	if (newCookies.length > 0) {
		const newResponse: Response = response.clone()
		newCookies.forEach((cookie) => {
			newResponse.headers.append("Set-Cookie", cookie)
		})

		return resp(newResponse)
	}

	resp(response)
}

/*
# RouteContext

.params: Params -> params from routing
.data: any -> data passed from middleware
.request: Request

.resp(response: Response): Response


.ok() -> force passes block event
*/

const handler = (ctx) => {
	// This handler errors out before returning a response

	throw new Error("oh something weird happened")
	// respond event: None
	// block event: Err(Error("oh something weird happened"))
}

const handler = (ctx) => {
	ctx.resp(new Response("yay!"))
	// respond event: Some(Resonse("yay!"))
	// block event: Ok
}

const handler = (ctx) => {
	ctx.resp(new Response("yay!"))
	// respond event: Some(Resonse("yay!"))
	// middlewarectx.next() promise resolves here
	throw new Error("Happens after response production")
	// block event: Err(Error("Happens after response production"))
	// middlewarectx.block() promise resolves here
	// handle this case however you want,
	// if block event is passed to the router with an error
	// it is rethrown and the app will crash
}

const handler = (ctx) => {
	// respond event: None
	// block event: Err(HandlerDidntRespond)

	// handle this case however you want,
	// if respond event is passed to the router with `None`
	// the app responds with a 500 error and prints a warning
}

const handler = (ctx) => {
	setTimeout(() => {
		ctx.resp(new Response("yay!"))
		// 4. (cancelled) respond event: Response("yay!")
	}, 300)
	// 1. (cancelled) block event: Ok
	// 2. respond event: None
	// 3. block event: Err(HandlerNotResponding)

	// if block event is fired before respond event (handler exits BEFORE responding),
	// the event is cancelled and replaced with a HandlerNotResponding Error

	// the next handler is the intended way to do something like this
}

const wait = async (ms: number) => {
	const { resolve, promise } = Promise.withResolvers()
	setTimeout(resolve, ms)
	return promise
}

const handler = async (ctx) => {
	await wait(300)
	ctx.resp(new Response("yay!"))
	// respond event: Some(Resonse("yay!"))
	// block event: Ok

	// the intended way to do delayed responses is with aysnc code
	// so that the block event doesn't fire before the respond event
}

const handler = async (ctx) => {
	const { resolve, promise } = Promise.withResolvers()
	someFunctionWithACallback("some data", (...args) => resolve(args))
	const dataFromCallback = await promise
	ctx.resp(new Response("yay!"))
	// respond event: Some(Resonse("yay!"))
	// block event: Ok

	// the intended way to do delayed responses is with aysnc code
	// so that the block event doesn't fire before the respond event
}

const handler = (ctx) => {
	ctx.resp(new Response("yay!"))
	// respond event: Some(Resonse("yay!"))
	// middlewarectx.next() promise resolves here
	ctx.ok()
	// block event: Ok
	// middlewarectx.block() promise resolves here
	throw new Error("Happens after block event")

	// this error is caught and warned but otherwise ignored
	// as .ok() basically tells wooter that the handler is done
	// and anything that happens afterward should be ignored
}

const app = wooter.build()

export default app

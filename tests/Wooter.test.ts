// deno-lint-ignore-file no-explicit-any no-unused-vars

import Wooter from "@/Wooter.ts"

import { assert, assertEquals, assertInstanceOf, assertIsError, assertRejects } from "@std/assert"
import { assertSpyCall, assertSpyCalls, type Spy, spy } from "@std/testing/mock"
import c from "@@/chemin.ts"
import type { Data, MiddlewareContext, MiddlewareHandler, Params } from "@@/types.ts"
import {
	HandlerDidntRespondError,
	HandlerRespondedTwiceError,
	isWooterError,
	MiddlewareCalledWaitBeforeNextError,
	MiddlewareHandlerDidntCallUpError,
	use,
} from "@@/index.ts"
function middlewareSpy<
	T extends unknown[],
	TParams extends Params = Params,
	TData extends Data | undefined = undefined,
	TNextData extends Data | undefined = undefined,
>(
	handler: (spy: Spy<any, T>, ctx: MiddlewareContext<TParams, TData, TNextData>) => Promise<unknown>,
): [Spy, MiddlewareHandler<TParams, TData, TNextData>] {
	const fn = spy<any, T>()
	return [fn, (ctx) => handler(fn, ctx)]
}

Deno.test("case 1 - handler responds", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response("Hello World!!"))
	})

	const response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), "Hello World!!")
})

Deno.test("use()", async () => {
	const wooter = new Wooter()

	const [spy, middleware] = middlewareSpy(async (spy, ctx) => {
		spy()
		await ctx.expectAndRespond({})
	})

	wooter.route(
		c.chemin(),
		"GET",
		// @ts-ignore
		use(middleware, async (ctx) => {
			ctx.resp(new Response())
		}),
	)

	const response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 200)

	assertSpyCalls(spy, 1)
})

Deno.test("case 2 - handler errors (before responding) + catching errors in middleware", async () => {
	const wooter = new Wooter()
	const [spy, middleware] = middlewareSpy(async (spy, ctx) => {
		try {
			console.log("before unwrapandrespond")
			await ctx.expectAndRespond({})
			console.log("before block")
			await ctx.wait()
		} catch (e) {
			console.log("error")
			console.warn(e)
			spy(e)
			ctx.resp(new Response("Internal Server Error", { status: 500 }))
		}
	})

	wooter.use(middleware)
	wooter.route(c.chemin(), "GET", (ctx) => {
		throw new Error("oh something weird happened")
	})
	const response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 500)
	assertEquals(await response.text(), "Internal Server Error")

	assertSpyCalls(spy, 1)
	const { args: [err] } = spy.calls[0]
	assertIsError(err)
})

Deno.test("middleware case 1 - middleware doesn't respond + wooter re-throw", async () => {
	const wooter = new Wooter()

	wooter.use((ctx) => {})
	wooter.route(c.chemin(), "GET", (ctx) => {
		throw new Error("oh something weird happened")
	})

	await assertRejects(
		async () => await wooter.fetch(new Request("http://localhost:3000/")),
		MiddlewareHandlerDidntCallUpError,
	)
})

Deno.test("middleware case 2 - middleware calls .wait" +
	"() before ", async () => {
	const wooter = new Wooter()

	wooter.use((ctx) => {})
	wooter.route(c.chemin(), "GET", (ctx) => {
		throw new Error("oh something weird happened")
	})

	await assertRejects(
		async () => await wooter.fetch(new Request("http://localhost:3000/")),
		MiddlewareHandlerDidntCallUpError,
	)
})

Deno.test("namespacing", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response("page 1"))
	})

	wooter.router(c.chemin("stuff")).route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response("page 2"))
	})
	let response: Response
	response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), "page 1")

	response = await wooter.fetch(new Request("http://localhost:3000/stuff"))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), "page 2")

	// assertSpyCalls(spy, 1)
	// const { args: [err] } = spy.calls[0]
	// assertIsError(err)
})

Deno.test("not found errors", async () => {
	const testResponse = new Response()
	const wooter = new Wooter()
	let response: Response
	response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 404)
	assertEquals(await response.text(), "Not found GET /")

	wooter.notFound((ctx) => ctx.resp(testResponse))

	response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response, testResponse)
})

Deno.test("middleware data", async () => {
	const randomNumber = Math.random()
	const wooter = new Wooter().use<{ random: number }>((ctx) => {
		ctx.expectAndRespond({ random: randomNumber })
	})

	wooter.route(c.chemin(), "GET", (ctx) => {
		const number = ctx.data.get("random")
		assertEquals(randomNumber, number)
		ctx.resp(new Response("Hello World!!"))
	})

	const response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), "Hello World!!")
})

Deno.test("Route parameters", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(c.pString("param")), "GET", (ctx) => {
		ctx.resp(new Response(ctx.params.get("param")))
	})

	const uuid = crypto.randomUUID()
	const response = await wooter.fetch(new Request(`http://localhost:3000/${uuid}`))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), uuid)
})

Deno.test("handler responds twice - causes an unhandled rejection", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response())
		ctx.resp(new Response())
	})

	addEventListener("unhandledrejection", (e) => {
		e.preventDefault()
		assertIsError(e.reason)
		assert(isWooterError(e.reason))
		assertInstanceOf(e.reason, HandlerRespondedTwiceError)
	})

	const response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), "")
})

Deno.test("handler doesn't respond", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {})

	try {
		const response = await wooter.fetch(new Request("http://localhost:3000/"))
		assertEquals(response.status, 500)
		assertEquals(await response.text(), "Internal Server Error")
	} catch (e) {
		console.log(e)
		assert(isWooterError(e))
		assert(e instanceof HandlerDidntRespondError)
	}
})

Deno.test("Handler not found if method doesn't match", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "POST", (ctx) => {})

	const response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 404)
	assertEquals(await response.text(), "Not found GET /")
})

Deno.test("Request logger example", async () => {
	const fn = spy<unknown, [response: Response]>()
	const uuid = crypto.randomUUID()
	const wooter = new Wooter().use(async (ctx) => {
		const response = await ctx.expectResponse({})
		response.headers.set("X-Request-Id", uuid)
		fn(response)
		ctx.resp(response)
	})

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response("Hello World!!"))
	})

	const response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), "Hello World!!")
	assert(response.headers.get("X-Request-Id") === uuid)

	assertSpyCalls(fn, 1)
	assert(fn.calls[0].args[0] === response)
})

Deno.test("Error logger example", async () => {
	const errorLog = spy<unknown, [error: any, uuid: string]>()
	const uuid = crypto.randomUUID()
	const wooter = new Wooter().use(async (ctx) => {
		let response: Response
		try {
			response = await ctx.expectResponse({})
		} catch (error) {
			errorLog(error, uuid)
			console.error(error)
			response = new Response("Internal Server Error", { status: 500 })
		}
		response.headers.set("X-Request-Id", uuid)

		ctx.resp(response)
	})

	wooter.route(c.chemin(), "GET", (ctx) => {
		throw null
	})

	const response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 500)
	assertEquals(await response.text(), "Internal Server Error")
	assert(response.headers.get("X-Request-Id") === uuid)

	assertSpyCalls(errorLog, 1)
	assertSpyCall(errorLog, 0, { args: [null, uuid] })
})

Deno.test("middleware calls .wait() before running handler", async () => {
	const wooter = new Wooter()

	wooter.use((ctx) => ctx.wait())
	wooter.route(c.chemin(), "GET", (ctx) => {})

	try {
		await wooter.fetch(new Request("http://localhost:3000/"))
	} catch (e) {
		console.log(e)
		assert(isWooterError(e))
		assert(e instanceof MiddlewareCalledWaitBeforeNextError)
	}
})

// Deno.test("ctx ok", async () => {
// 	const wooter = new Wooter()
// 	const fn = spy<any, [state: string]>()

// 	wooter.use<{ fn: typeof fn }>(async (ctx) => {
// 		ctx.unwrapAndRespond({ fn }).then(() => fn("a"))
// 		ctx.wait().then(() => fn("b"))
// 	})
// 	wooter.route(c.chemin(), "GET", (ctx) => {
// 		ctx.resp(new Response("Hello world"))
// 		ctx.ok()
// 		setTimeout(() => {
// 			fn("c")
// 			console.log("after .ok()")
// 		}, 1)
// 	})

// 	const [response, v] = wooter.fetch(new Request("http://localhost:3000/"))
// 	console.log(await response, fn)
// 	await v
// })

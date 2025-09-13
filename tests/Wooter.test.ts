import Wooter from "@/Wooter.ts"

import { assertEquals, type assertThrows } from "jsr:@std/assert"
import { assertSpyCalls, type Spy, spy } from "jsr:@std/testing/mock"
import c from "@/export/chemin.ts"
import type { Data, MiddlewareContext, MiddlewareHandler, Params } from "@/export/types.ts"
import { assertIsError } from "jsr:@std/assert@^1.0.10/is-error"
import { assert } from "jsr:@std/assert/assert"
import { isWooterError, MiddlewareHandlerDidntCallUpError } from "@/export/index.ts"

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

const catchErrors: MiddlewareHandler = async (ctx) => {
	try {
		console.log("before unwrapandrespond")
		await ctx.unwrapAndRespond({})
		console.log("before block")
		await ctx.block()
	} catch (e) {
		console.log("error")
		console.warn(e)
		ctx.resp(new Response("Internal Server Error", { status: 500 }))
	}
}

Deno.test("case 1 - handler resopnds", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response("Hello World!!"))
	})

	const response = await wooter.fetch(new Request("http://localhost:3000/"))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), "Hello World!!")
})

Deno.test("case 2 - handler errors (before responding) + catching errors in middleware", async () => {
	const wooter = new Wooter()
	const [spy, middleware] = middlewareSpy(async (spy, ctx) => {
		try {
			console.log("before unwrapandrespond")
			await ctx.unwrapAndRespond({})
			console.log("before block")
			await ctx.block()
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
	try {
		const response = await wooter.fetch(new Request("http://localhost:3000/"))
		assertEquals(response.status, 500)
		assertEquals(await response.text(), "Internal Server Error")
	} catch (e) {
		assert(isWooterError(e))
		assert(e instanceof MiddlewareHandlerDidntCallUpError)
	}
})

Deno.test("middleware case 2 - middleware calls .block() before ", async () => {
	const wooter = new Wooter()

	wooter.use((ctx) => {})
	wooter.route(c.chemin(), "GET", (ctx) => {
		throw new Error("oh something weird happened")
	})
	try {
		const response = await wooter.fetch(new Request("http://localhost:3000/"))
		assertEquals(response.status, 500)
		assertEquals(await response.text(), "Internal Server Error")
	} catch (e) {
		assert(isWooterError(e))
		assert(e instanceof MiddlewareHandlerDidntCallUpError)
	}
})

Deno.test("namespacing", async () => {
	const wooter = new Wooter()

	wooter.use((ctx) => {})
	wooter.route(c.chemin(), "GET", (ctx) => {
		throw new Error("oh something weird happened")
	})
	try {
		const response = await wooter.fetch(new Request("http://localhost:3000/"))
		assertEquals(response.status, 500)
		assertEquals(await response.text(), "Internal Server Error")
	} catch (e) {
		assert(isWooterError(e))
		assert(e instanceof MiddlewareHandlerDidntCallUpError)
	}

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

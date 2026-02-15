import { assert, assertEquals } from "@std/assert"
import { assertSpyCalls, spy } from "@std/testing/mock"
import Wooter from "@/Wooter.ts"
import c from "@@/chemin.ts"
import use, { middleware } from "@@/use.ts"

Deno.test("middleware - creates typed middleware handler", async () => {
	const authMiddleware = middleware<{ userId: number }>(async (ctx) => {
		await ctx.expectAndRespond({ userId: 123 })
	})
	const wooter = new Wooter().use(authMiddleware)

	wooter.route(c.chemin(), "GET", (ctx) => {
		const userId = ctx.data.userId
		assertEquals(userId, 123)
		ctx.resp(new Response("OK"))
	})

	const response = await wooter.fetch(new Request("http://localhost/"))
	assertEquals(response.status, 200)
})

Deno.test("use - applies middleware to specific handler", async () => {
	const wooter = new Wooter()
	const middlewareSpy = spy()

	const testMiddleware = middleware<{ value: string }>(async (ctx) => {
		middlewareSpy()
		await ctx.expectAndRespond({ value: "from-middleware" })
	})

	wooter.route(
		c.chemin("with-middleware"),
		"GET",
		use(testMiddleware, (ctx) => {
			assertEquals(ctx.data.value, "from-middleware")
			ctx.resp(new Response("OK"))
		}),
	)

	wooter.route(c.chemin("without-middleware"), "GET", (ctx) => {
		ctx.resp(new Response("OK"))
	})

	// Request to route with middleware
	await wooter.fetch(new Request("http://localhost/with-middleware"))
	assertSpyCalls(middlewareSpy, 1)

	// Request to route without middleware
	await wooter.fetch(new Request("http://localhost/without-middleware"))
	assertSpyCalls(middlewareSpy, 1) // Should still be 1
})

Deno.test("use - middleware can modify request", async () => {
	const wooter = new Wooter()

	const addHeaderMiddleware = middleware(async (ctx) => {
		const newRequest = new Request(ctx.request.url, {
			headers: {
				...Object.fromEntries(ctx.request.headers.entries()),
				"X-Modified": "true",
			},
		})
		const response = await ctx.expectResponse({}, newRequest)
		ctx.resp(response)
	})

	wooter.route(
		c.chemin(),
		"GET",
		use(addHeaderMiddleware, (ctx) => {
			const modified = ctx.request.headers.get("X-Modified")
			assertEquals(modified, "true")
			ctx.resp(new Response("OK"))
		}),
	)

	const response = await wooter.fetch(new Request("http://localhost/"))
	assertEquals(response.status, 200)
})

Deno.test("use - can chain multiple middlewares", async () => {
	const wooter = new Wooter()
	const executionOrder: number[] = []

	const middleware1 = middleware<{ step1: boolean }>(async (ctx) => {
		executionOrder.push(1)
		await ctx.expectAndRespond({ step1: true })
	})

	const middleware2 = middleware<{ step2: boolean }, { step1: boolean }>(async (ctx) => {
		executionOrder.push(2)
		assert(ctx.data.step1)
		await ctx.expectAndRespond({ step2: true })
	})

	wooter.route(
		c.chemin(),
		"GET",
		use(
			middleware1,
			use(middleware2, (ctx) => {
				executionOrder.push(3)
				assert(ctx.data.step1)
				assert(ctx.data.step2)
				ctx.resp(new Response("OK"))
			}),
		),
	)

	const response = await wooter.fetch(new Request("http://localhost/"))
	assertEquals(response.status, 200)
	assertEquals(executionOrder, [1, 2, 3])
})

Deno.test("use - passes route parameters correctly", async () => {
	const wooter = new Wooter()

	const paramMiddleware = middleware<undefined, undefined, { id: string }>(async (ctx) => {
		await ctx.expectAndRespond({})
	})

	wooter.route(
		c.chemin(c.pString("id")),
		"GET",
		use(paramMiddleware, (ctx) => {
			const id = ctx.params.get("id")
			assertEquals(id, "test-123")
			ctx.resp(new Response(`ID: ${id}`))
		}),
	)

	const response = await wooter.fetch(new Request("http://localhost/test-123"))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), "ID: test-123")
})

Deno.test("middleware - returns same handler function", () => {
	const handler = async (ctx: any) => {
		await ctx.unwrapAndRespond({})
	}

	const wrapped = middleware(handler)
	assertEquals(wrapped, handler)
})

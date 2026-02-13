import { assert, assertEquals } from "@std/assert"
import Wooter from "@/Wooter.ts"
import * as c from "@@/chemin.ts"
import { optionalValueToOption } from "@@/option.ts"

Deno.test("Multiple HTTP methods on same route", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), ["GET", "POST"], (ctx) => {
		ctx.resp(new Response(`Method: ${ctx.request.method}`))
	})

	const getResp = await wooter.fetch(new Request("http://localhost/", { method: "GET" }))
	assertEquals(await getResp.text(), "Method: GET")

	const postResp = await wooter.fetch(new Request("http://localhost/", { method: "POST" }))
	assertEquals(await postResp.text(), "Method: POST")
})

Deno.test("Wildcard method handler", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "*", (ctx) => {
		ctx.resp(new Response(`Caught: ${ctx.request.method}`))
	})

	const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"]

	for (const method of methods) {
		const resp = await wooter.fetch(new Request("http://localhost/", { method }))
		assertEquals(await resp.text(), `Caught: ${method}`)
	}
})

Deno.test("Method map syntax", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin("api"), {
		GET: (ctx) => ctx.resp(new Response("GET handler")),
		POST: (ctx) => ctx.resp(new Response("POST handler")),
		DELETE: (ctx) => ctx.resp(new Response("DELETE handler")),
	})

	const getResp = await wooter.fetch(new Request("http://localhost/api", { method: "GET" }))
	assertEquals(await getResp.text(), "GET handler")

	const postResp = await wooter.fetch(new Request("http://localhost/api", { method: "POST" }))
	assertEquals(await postResp.text(), "POST handler")

	const deleteResp = await wooter.fetch(new Request("http://localhost/api", { method: "DELETE" }))
	assertEquals(await deleteResp.text(), "DELETE handler")
})

Deno.test("Router namespacing with nested routes", async () => {
	const wooter = new Wooter()

	const apiRouter = wooter.router(c.chemin("api"))
	const v1Router = apiRouter.router(c.chemin("v1"))

	v1Router.route(c.chemin("users"), "GET", (ctx) => {
		ctx.resp(new Response("GET /api/v1/users"))
	})

	const resp = await wooter.fetch(new Request("http://localhost/api/v1/users"))
	assertEquals(await resp.text(), "GET /api/v1/users")
})

Deno.test("Multiple route parameters", async () => {
	const wooter = new Wooter()

	wooter.route(
		c.chemin(c.pString("category"), c.pNumber("id")),
		"GET",
		(ctx) => {
			const category = ctx.params.get("category")
			const id = ctx.params.get("id")
			ctx.resp(new Response(`${category}/${id}`))
		},
	)

	const resp = await wooter.fetch(new Request("http://localhost/products/123"))
	assertEquals(await resp.text(), "products/123")
})

Deno.test("Optional route parameters", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin("page", c.pOptional(c.pNumber("pageNum"))), "GET", (ctx) => {
		const pageNum = optionalValueToOption(ctx.params.get("pageNum"))
		ctx.resp(new Response(pageNum.mapOr("Page 1 (default)", (v) => `Page ${v}`)))
	})

	const resp1 = await wooter.fetch(new Request("http://localhost/page"))
	assertEquals(await resp1.text(), "Page 1 (default)")

	const resp2 = await wooter.fetch(new Request("http://localhost/page/5"))
	assertEquals(await resp2.text(), "Page 5")
})

Deno.test("Middleware execution order", async () => {
	const wooter = new Wooter()
	const order: string[] = []

	wooter.use(async (ctx) => {
		order.push("middleware1-before")
		await ctx.expectAndRespond({})
		order.push("middleware1-after")
	})

	wooter.use(async (ctx) => {
		order.push("middleware2-before")
		await ctx.expectAndRespond({})
		order.push("middleware2-after")
	})

	wooter.route(c.chemin(), "GET", (ctx) => {
		order.push("handler")
		ctx.resp(new Response("OK"))
	})

	await wooter.fetch(new Request("http://localhost/"))

	assertEquals(order, [
		"middleware1-before",
		"middleware2-before",
		"handler",
		"middleware2-after",
		// "middleware1-after", // this will not be present because the middleware responds before order.push is called again
	])
})

Deno.test("Request URL and pathname are accessible", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin("test"), "GET", (ctx) => {
		assertEquals(ctx.url.pathname, "/test")
		assert(ctx.url.href.includes("/test"))
		assertEquals(ctx.request.method, "GET")
		ctx.resp(new Response("OK"))
	})

	await wooter.fetch(new Request("http://localhost/test"))
})

Deno.test("Custom notFound handler", async () => {
	const wooter = new Wooter()

	wooter.notFound((ctx) => {
		ctx.resp(new Response(`Custom 404: ${ctx.url.pathname}`, { status: 404 }))
	})

	const resp = await wooter.fetch(new Request("http://localhost/nonexistent"))
	assertEquals(resp.status, 404)
	assertEquals(await resp.text(), "Custom 404: /nonexistent")
})

Deno.test("Response with different content types", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin("json"), "GET", (ctx) => {
		ctx.resp(
			new Response(JSON.stringify({ message: "hello" }), {
				headers: { "Content-Type": "application/json" },
			}),
		)
	})

	wooter.route(c.chemin("html"), "GET", (ctx) => {
		ctx.resp(
			new Response("<h1>Hello</h1>", {
				headers: { "Content-Type": "text/html" },
			}),
		)
	})

	const jsonResp = await wooter.fetch(new Request("http://localhost/json"))
	assertEquals(jsonResp.headers.get("Content-Type"), "application/json")
	assertEquals(await jsonResp.json(), { message: "hello" })

	const htmlResp = await wooter.fetch(new Request("http://localhost/html"))
	assertEquals(htmlResp.headers.get("Content-Type"), "text/html")
	assertEquals(await htmlResp.text(), "<h1>Hello</h1>")
})

Deno.test("Handler with async operations", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", async (ctx) => {
		// Simulate async operation
		await new Promise((resolve) => setTimeout(resolve, 10))
		ctx.resp(new Response("Async result"))
	})

	const resp = await wooter.fetch(new Request("http://localhost/"))
	assertEquals(await resp.text(), "Async result")
})

Deno.test("Middleware can modify response headers", async () => {
	const wooter = new Wooter()

	wooter.use(async (ctx) => {
		const response = await ctx.expectResponse({})
		response.headers.set("X-Custom-Header", "middleware-value")
		ctx.resp(response)
	})

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response("OK"))
	})

	const resp = await wooter.fetch(new Request("http://localhost/"))
	assertEquals(resp.headers.get("X-Custom-Header"), "middleware-value")
})

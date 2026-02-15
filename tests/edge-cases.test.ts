import { assert, assertEquals, assertRejects } from "@std/assert"
import Wooter from "@/Wooter.ts"
import c from "@@/chemin.ts"
import { MiddlewareHandlerDidntCallUpError } from "@@/index.ts"

Deno.test("Empty route path", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response("Root"))
	})

	const resp = await wooter.fetch(new Request("http://localhost/"))
	assertEquals(await resp.text(), "Root")
})

Deno.test("Route with trailing slash", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin("path"), "GET", (ctx) => {
		ctx.resp(new Response("OK"))
	})

	// Without trailing slash
	const resp1 = await wooter.fetch(new Request("http://localhost/path"))
	assertEquals(resp1.status, 200)

	// With trailing slash - chemin should handle this
	const resp2 = await wooter.fetch(new Request("http://localhost/path/"))
	assert(resp2.status === 200)
})

Deno.test("Query parameters are preserved in request", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin("search"), "GET", (ctx) => {
		const searchParams = new URL(ctx.request.url).searchParams
		const query = searchParams.get("q")
		ctx.resp(new Response(`Query: ${query}`))
	})

	const resp = await wooter.fetch(new Request("http://localhost/search?q=test"))
	assertEquals(await resp.text(), "Query: test")
})

Deno.test("Request body is accessible", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin("echo"), "POST", async (ctx) => {
		const body = await ctx.request.text()
		ctx.resp(new Response(`Echo: ${body}`))
	})

	const resp = await wooter.fetch(
		new Request("http://localhost/echo", {
			method: "POST",
			body: "Hello World",
		}),
	)

	assertEquals(await resp.text(), "Echo: Hello World")
})

Deno.test("Request headers are accessible", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {
		const userAgent = ctx.request.headers.get("User-Agent")
		ctx.resp(new Response(`UA: ${userAgent}`))
	})

	const resp = await wooter.fetch(
		new Request("http://localhost/", {
			headers: { "User-Agent": "TestBot/1.0" },
		}),
	)

	assertEquals(await resp.text(), "UA: TestBot/1.0")
})

Deno.test("Case sensitivity of HTTP methods", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response("GET handler"))
	})

	// HTTP methods should be case-insensitive in practice,
	// but Request constructor normalizes them
	const resp = await wooter.fetch(new Request("http://localhost/", { method: "GET" }))
	assertEquals(await resp.text(), "GET handler")
})

Deno.test("Empty response body", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response(null))
	})

	const resp = await wooter.fetch(new Request("http://localhost/"))
	assertEquals(resp.status, 200)
	assertEquals(await resp.text(), "")
})

Deno.test("Response with custom status code", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin("created"), "POST", (ctx) => {
		ctx.resp(new Response("Created", { status: 201 }))
	})

	wooter.route(c.chemin("accepted"), "POST", (ctx) => {
		ctx.resp(new Response(null, { status: 202 }))
	})

	const resp1 = await wooter.fetch(new Request("http://localhost/created", { method: "POST" }))
	assertEquals(resp1.status, 201)

	const resp2 = await wooter.fetch(new Request("http://localhost/accepted", { method: "POST" }))
	assertEquals(resp2.status, 202)
})

Deno.test("Middleware without calling next throws error", async () => {
	const wooter = new Wooter()

	wooter.use(async (ctx) => {
		// Deliberately not calling ctx.next() or ctx.unwrapAndRespond()
		// This should cause an error
	})

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(new Response("OK"))
	})

	assertRejects(async () => {
		await wooter.fetch(new Request("http://localhost/"))
	}, MiddlewareHandlerDidntCallUpError)
})

Deno.test("Number parameter validation", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(c.pNumber("id")), "GET", (ctx) => {
		const id = ctx.params.get("id")
		assertEquals(typeof id, "number")
		ctx.resp(new Response(`ID: ${id}`))
	})

	// Valid number
	const resp1 = await wooter.fetch(new Request("http://localhost/123"))
	assertEquals(await resp1.text(), "ID: 123")

	// Invalid number should not match the route
	const resp2 = await wooter.fetch(new Request("http://localhost/abc"))
	assertEquals(resp2.status, 404)
})

Deno.test("String parameter accepts any value", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(c.pString("slug")), "GET", (ctx) => {
		const slug = ctx.params.get("slug")
		ctx.resp(new Response(slug))
	})

	const testValues = ["hello", "123", "hello-world", "test_123"]

	for (const value of testValues) {
		const resp = await wooter.fetch(new Request(`http://localhost/${value}`))
		assertEquals(await resp.text(), value)
	}
})

Deno.test("Middleware data persistence", async () => {
	const wooter = new Wooter().use<{ timestamp: number }>(async (ctx) => {
		await ctx.expectAndRespond({ timestamp: Date.now() })
	})

	wooter.route(c.chemin(), "GET", (ctx) => {
		const timestamp = ctx.data.timestamp
		assert(typeof timestamp === "number")
		assert(timestamp > 0)
		ctx.resp(new Response("OK"))
	})

	await wooter.fetch(new Request("http://localhost/"))
})

Deno.test("Multiple middleware data merging", async () => {
	const wooter = new Wooter().use<{ auth: boolean }>(async (ctx) => {
		await ctx.expectAndRespond({ auth: true })
	}).use<{ userId: number }>(async (ctx) => {
		const auth = ctx.data.auth
		assert(auth === true)
		await ctx.expectAndRespond({ userId: 42 })
	})

	wooter.route(c.chemin(), "GET", (ctx) => {
		assertEquals(ctx.data.auth, true)
		assertEquals(ctx.data.userId, 42)
		ctx.resp(new Response("OK"))
	})

	await wooter.fetch(new Request("http://localhost/"))
})

Deno.test("Response status text", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin(), "GET", (ctx) => {
		ctx.resp(
			new Response("Custom error", {
				status: 400,
				statusText: "Bad Request",
			}),
		)
	})

	const resp = await wooter.fetch(new Request("http://localhost/"))
	assertEquals(resp.status, 400)
	assertEquals(resp.statusText, "Bad Request")
})

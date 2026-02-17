import { assertEquals } from "@std/assert"
import Wooter from "@/Wooter.ts"
import c from "@@/chemin.ts"
import { middleware } from "@@/use.ts"

Deno.test("Control-flow throw after resp() does not crash", async () => {
	// This simulates a parseJson middleware that responds with an error
	// and then throws a primitive value for control flow
	const parseJsonMiddleware = middleware<{ json: () => Promise<any> }>(
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
						// Throw for control flow (not a real error)
						throw 0
					}
				},
			})
		},
	)

	const wooter = new Wooter()
		.use(parseJsonMiddleware)

	wooter.route(c.chemin("test"), "POST", async (ctx) => {
		// Try to parse JSON - this should fail and respond with error
		await ctx.data.json()
		// This should never be reached because parseJson responds with error
		ctx.resp(new Response("OK"))
	})

	// Send invalid JSON
	const resp = await wooter.fetch(
		new Request("http://localhost/test", {
			method: "POST",
			body: "invalid json",
			headers: { "Content-Type": "application/json" },
		}),
	)

	// Should get the error response from parseJson, not a crash
	assertEquals(resp.status, 400)
	const body = await resp.json()
	assertEquals(body.error, "Invalid JSON")
})

Deno.test("Real Error after resp() is still logged", async () => {
	// Test that actual Error instances after resp() are still surfaced
	const errorAfterRespMiddleware = middleware<{ getData: () => Promise<void> }>(async ({ resp, expectAndRespond }) => {
		await expectAndRespond({
			getData: async () => {
				// Respond first
				resp(new Response("Already responded"))
				// Throw a real Error (should be logged, not crash)
				throw new Error("This is a real bug")
			},
		})
	})

	const wooter = new Wooter()
		.use(errorAfterRespMiddleware)

	wooter.route(c.chemin("test"), "GET", async (ctx) => {
		// Call getData which will respond and throw
		await ctx.data.getData()
		// This should never be reached
		ctx.resp(new Response("OK"))
	})

	const resp = await wooter.fetch(new Request("http://localhost/test"))

	// Should still get the response
	assertEquals(resp.status, 200)
	assertEquals(await resp.text(), "Already responded")
	// The Error should be logged to console (console.error)
	// but not crash the handler
})

Deno.test("Primitive throw (string) after resp() is silenced", async () => {
	const throwStringMiddleware = middleware<{ check: () => Promise<void> }>(async ({ resp, expectAndRespond }) => {
		await expectAndRespond({
			check: async () => {
				resp(new Response("Check failed", { status: 403 }))
				throw "access denied" // String throw for control flow
			},
		})
	})

	const wooter = new Wooter()
		.use(throwStringMiddleware)

	wooter.route(c.chemin("test"), "GET", async (ctx) => {
		// Call check which will respond and throw
		await ctx.data.check()
		// This should never be reached
		ctx.resp(new Response("OK"))
	})

	const resp = await wooter.fetch(new Request("http://localhost/test"))

	assertEquals(resp.status, 403)
	assertEquals(await resp.text(), "Check failed")
})

Deno.test("Primitive throw (undefined) after resp() is silenced", async () => {
	const throwUndefinedMiddleware = middleware<{ validate: () => Promise<void> }>(async ({ resp, expectAndRespond }) => {
		await expectAndRespond({
			validate: async () => {
				resp(new Response("Validation failed", { status: 422 }))
				throw undefined // Undefined throw for control flow
			},
		})
	})

	const wooter = new Wooter()
		.use(throwUndefinedMiddleware)

	wooter.route(c.chemin("test"), "POST", async (ctx) => {
		// Call validate which will respond and throw
		await ctx.data.validate()
		// This should never be reached
		ctx.resp(new Response("OK"))
	})

	const resp = await wooter.fetch(
		new Request("http://localhost/test", { method: "POST" }),
	)

	assertEquals(resp.status, 422)
	assertEquals(await resp.text(), "Validation failed")
})

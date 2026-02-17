import { assertEquals } from "@std/assert"
import Wooter from "@/Wooter.ts"
import c from "@@/chemin.ts"
import { ControlFlowBreak, middleware } from "@@/index.ts"

Deno.test("Control-flow throw after resp() does not crash", async () => {
	// This simulates a parseJson middleware that responds with an error
	// and then throws ControlFlowBreak for control flow
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
						// Throw ControlFlowBreak to exit cleanly
						throw ControlFlowBreak
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

Deno.test("Only ControlFlowBreak is silenced after resp()", async () => {
	// Verify that throwing ControlFlowBreak after resp() works,
	// but other values don't get special treatment
	const controlFlowMiddleware = middleware<{ check: () => Promise<void> }>(async ({ resp, expectAndRespond }) => {
		await expectAndRespond({
			check: async () => {
				resp(new Response("Check completed", { status: 200 }))
				throw ControlFlowBreak // This should be silenced
			},
		})
	})

	const wooter = new Wooter()
		.use(controlFlowMiddleware)

	wooter.route(c.chemin("test"), "GET", async (ctx) => {
		// Call check which will respond and throw ControlFlowBreak
		await ctx.data.check()
		// This should never be reached
		ctx.resp(new Response("OK"))
	})

	const resp = await wooter.fetch(new Request("http://localhost/test"))

	assertEquals(resp.status, 200)
	assertEquals(await resp.text(), "Check completed")
})

Deno.test("ControlFlowBreak with validation middleware works correctly", async () => {
	const throwUndefinedMiddleware = middleware<{ validate: () => Promise<void> }>(async ({ resp, expectAndRespond }) => {
		await expectAndRespond({
			validate: async () => {
				resp(new Response("Validation failed", { status: 422 }))
				throw ControlFlowBreak // Use ControlFlowBreak symbol
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

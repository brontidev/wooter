import { assertEquals } from "@std/assert"
import { c, middleware, Wooter } from "@/export/index.ts"

Deno.test("helper responding on middleware context satisfies downstream response requirement", async () => {
	const app = new Wooter()
		.use<{ render: () => void }>(
			middleware(async ({ forward, resp }) => {
				await forward({
					render() {
						resp(new Response("rendered from middleware helper"))
					},
				})
			}),
		)

	app.route(c.chemin(), "GET", ({ state: { render } }) => {
		render()
	})

	const response = await app.fetch(new Request("http://localhost/", { method: "GET" }))
	assertEquals(response.status, 200)
	assertEquals(await response.text(), "rendered from middleware helper")
})

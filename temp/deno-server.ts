import { c, Wooter } from "@@/index.ts"

const wooter = new Wooter()
wooter.route(c.chemin("min"), "GET", async (ctx) => {
	const file = await Deno.readFile("./out/index.m.js")
	ctx.resp(
		new Response(file, {
			headers: {
				"Content-Type": "text/javascript",
				"X-Typescript-Types": "./index.d.ts",
			},
		}),
	)
})

wooter.route(c.chemin(), "GET", async (ctx) => {
	const file = await Deno.readFile("./out/index.js")
	ctx.resp(
		new Response(file, {
			headers: {
				"Content-Type": "text/javascript",
				"X-Typescript-Types": "./index.d.ts",
			},
		}),
	)
})

wooter.route(c.chemin("index.d.ts"), "GET", async (ctx) => {
	const file = await Deno.readFile("./out/index.d.ts")
	ctx.resp(
		new Response(file, {
			headers: {
				"Content-Type": "text/typescript",
			},
		}),
	)
})

export default wooter

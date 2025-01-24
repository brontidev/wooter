import { chemin, pNumber } from "./src/export/chemin.ts"
import { delay } from "jsr:@std/async"
import { Wooter } from "./src/export/index.ts"

const wooter = Wooter.withMethods()

wooter.GET(chemin(), async ({ err, resp }) => {
	resp(new Response("hi"))
})

wooter.GET(chemin("error"), async ({ err, resp }) => {
	err("An error occured!!")
})

wooter.GET(chemin("with", pNumber("param")), async ({ err, resp, params }) => {
	resp(new Response(`hi ${params.param}`))
})

wooter.GET(chemin("after"), async ({ err, resp, params }) => {
	resp(new Response("ok!"))
	await delay(400)
	console.log("this ran after the response was sent.")
})

const { fetch } = wooter
Deno.serve({ port: 3000 }, fetch.bind(wooter))

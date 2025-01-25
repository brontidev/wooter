import { delay } from "jsr:@std/async"
import { c, Wooter } from "../src/export/index.ts"

const wooter = Wooter.withMethods()

wooter.GET(c.chemin(), async ({ err, resp }) => {
	resp(new Response("hi"))
})

wooter.GET(c.chemin("error"), async ({ err, resp }) => {
	err("An error occured!!")
})

wooter.GET(
	c.chemin("with", c.pNumber("param")),
	async ({ err, resp, params }) => {
		resp(new Response(`hi ${params.param}`))
	},
)

wooter.GET(c.chemin("after"), async ({ err, resp }) => {
	resp(new Response("ok!"))
	await delay(400)
	console.log("this ran after the response was sent.")
})

wooter.GET(c.chemin("websocket"), async ({ request, err, resp }) => {
	if (request.headers.get("upgrade") !== "websocket") {
		return resp(new Response(null, { status: 501 }))
	}
	const { socket, response } = Deno.upgradeWebSocket(request)
	resp(response)

	socket.addEventListener("open", () => {
		console.log("a client connected!")
	})

	socket.addEventListener("message", (event) => {
		if (event.data === "ping") {
			socket.send("pong")
		}
	})
})

wooter.GET(c.chemin("exits-without-response"), async ({}) => {
})

wooter.GET(c.chemin("takes-a-while"), async ({ resp }) => {
	await delay(400)
	resp(new Response("I'm here! sorry I took so long"))
})

const { fetch } = wooter
Deno.serve({ port: 3000 }, fetch)

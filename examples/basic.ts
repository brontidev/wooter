import { delay } from "jsr:@std/async"
import { c, Wooter } from "@@/index.ts"

const wooter = new Wooter()

wooter.route(c.chemin(), "GET", async ({ resp }) => {
	resp(new Response("hi"))
})

wooter.route(c.chemin("error"), "GET", async ({ resp }) => {
	throw new Error("An error occurred!!")
})

wooter.route(c.chemin("gleem"), "GET", async ({ resp }) => {
	resp(new Response("glirp"))
})

wooter.route(c.chemin("beep", c.pString("a")), {
	async GET({ resp, params }) {
		const a = params.get("a")
		resp(new Response("boop: " + a))
	},
	async POST({ resp }) {
		resp(new Response("bop"))
	},
})

wooter.route(c.chemin("beep"), "GET", async ({ resp }) => {
	resp(new Response("boop"))
})

wooter.route(
	c.chemin("with", c.pNumber("param")),
	"GET",
	async ({ resp, params }) => {
		resp(new Response(`hi ${params.get("param")}`))
	},
)

wooter.route(c.chemin("after"), "GET", async ({ resp }) => {
	resp(new Response("ok!"))
	await delay(1000)
	console.log("this ran after the response was sent.")
})

wooter.route(c.chemin("websocket"), "GET", async ({ request, resp }) => {
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

wooter.route(c.chemin("exits-without-response"), "GET", async ({}) => {})

wooter.route(c.chemin("crash"), "GET", ({ resp }) => {
	resp(new Response("OK"))
	throw new Error()
})

wooter.route(c.chemin("takes-a-while"), "GET", async ({ resp }) => {
	await delay(1000)
	resp(new Response("I'm here! sorry I took so long"))
})

const { fetch } = wooter
Deno.serve({ port: 3000 }, fetch)

import { delay } from "jsr:@std/async"
import { p, Wooter } from "@@/mod.ts"
import cookies from "./middleware/cookies.ts"

const wooter = new Wooter(undefined, (e) => {
	console.error(e)
}).use(cookies)

wooter.route(p.path(), "GET", async ({ resp }) => {
	resp(new Response("hi"))
})

wooter.route(p.path("error"), "GET", async ({ resp }) => {
	throw new Error("An error occurred!!")
})

wooter.route(p.path("gleem"), "GET", async ({ resp }) => {
	resp(new Response("glirp"))
})

wooter.route(p.path("beep", p.param("a")), {
	async GET({ resp, params }) {
		const a = params.get("a")
		resp(new Response("boop: " + a))
	},
	async POST({ resp }) {
		resp(new Response("bop"))
	},
})

wooter.route(p.path("beep"), "GET", async ({ resp }) => {
	resp(new Response("boop"))
})

wooter.route(
	p.path("with", p.param("param", p.num)),
	"GET",
	async ({ resp, params }) => {
		resp(new Response(`hi ${params.get("param")}`))
	},
)

wooter.route(p.path("after"), "GET", async ({ resp }) => {
	resp(new Response("ok!"))
	await delay(1000)
	console.log("this ran after the response was sent.")
})

wooter.route(p.path("websocket"), "GET", async ({ request, resp }) => {
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

wooter.route(p.path("exits-without-response"), "GET", async ({}) => {})

wooter.route(p.path("crash"), "GET", ({ resp }) => {
	resp(new Response("OK"))
	throw new Error()
})

wooter.route(p.path("takes-a-while"), "GET", async ({ resp }) => {
	await delay(1000)
	resp(new Response("I'm here! sorry I took so long"))
})

const { fetch } = wooter

export default wooter

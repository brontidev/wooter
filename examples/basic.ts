import { delay } from "jsr:@std/async"
import { c, Wooter } from "../src/export/index.ts"
import { StandaloneMiddlewareHandler } from "@/export/types.ts"
import { use } from "@/export/util.ts"

const wooter = new Wooter()

// wooter.GET(c.chemin(), async ({ err, resp }) => {
// 	resp(new Response("hi"))
// })

// wooter.GET(c.chemin("error"), async ({ err, resp }) => {
// 	err("An error occured!!")
// })

wooter.route.GET(c.chemin("gleem"), async ({ err, resp }) => {
	resp(new Response("glirp"))
})

wooter.route(c.chemin("beep", c.pString("a")), {
	async GET({ err, resp, params: { a } }) {
		resp(new Response("boop: " + a))
	},
	async POST({ err, resp }) {
		resp(new Response("bop"))
	},
})

wooter.route.GET(c.chemin("beep"), async ({ err, resp }) => {
	resp(new Response("boop"))
})

wooter.route.GET(
	c.chemin("with", c.pNumber("param")),
	async ({ err, resp, params }) => {
		resp(new Response(`hi ${params.param}`))
	},
)

const skibidiMiddleware: StandaloneMiddlewareHandler<{ skibidi: number }> = async ({ up }) => {
  await up({ skibidi: Math.random() })
}

wooter.route.GET(c.chemin("mddd"), use(skibidiMiddleware, async ({ resp, data: { skibidi } }) => {
  resp(new Response("mddd: " + skibidi))
}))

// wooter.GET(c.chemin("after"), async ({ err, resp }) => {
// 	resp(new Response("ok!"))
// 	await delay(1000)
// 	console.log("this ran after the response was sent.")
// })

// wooter.GET(c.chemin("websocket"), async ({ request, err, resp }) => {
// 	if (request.headers.get("upgrade") !== "websocket") {
// 		return resp(new Response(null, { status: 501 }))
// 	}
// 	const { socket, response } = Deno.upgradeWebSocket(request)
// 	resp(response)

// 	socket.addEventListener("open", () => {
// 		console.log("a client connected!")
// 	})

// 	socket.addEventListener("message", (event) => {
// 		if (event.data === "ping") {
// 			socket.send("pong")
// 		}
// 	})
// })

// wooter.GET(c.chemin("exits-without-response"), async ({}) => {
// })

// wooter.GET(c.chemin("takes-a-while"), async ({ resp }) => {
// 	await delay(1000)
// 	resp(new Response("I'm here! sorry I took so long"))
// })

const { fetch } = wooter
Deno.serve({ port: 3000 }, fetch)

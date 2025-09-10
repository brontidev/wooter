import RouterGraph from "@/graph/RouterGraph.ts"
import c from "@/export/chemin.ts"
import {
	RouteContext__block,
	RouteContext__respond,
} from "@/ctx/RouteContext.ts"

const graph = new RouterGraph()

graph.addRoute_type0(c.chemin(), {
	GET: async ({ resp }) => {
		resp(new Response("Hello World"))
	},
})

graph.addMiddleware(async ({ unwrapAndRespond }) => {
	console.log("in middleware", await unwrapAndRespond())
})

const handler = graph.getHandler("", "get")
const ctx = handler!(
	{},
	new Request("http://localhost:3000/", { method: "GET" }),
)
ctx[RouteContext__respond].promise.then((v) =>
	console.log("respond event: ", v.toString())
)
ctx[RouteContext__block].promise.then((v) => console.log("block event: ", v.toString()))

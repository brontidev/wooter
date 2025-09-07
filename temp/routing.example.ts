import RouterGraph from "@/graph/RouterGraph.ts"
import c from "@/export/chemin.ts"
import { RouteContext__block, RouteContext__respond, RouteContext__respond_channel } from "@/ctx/RouteContext.ts"

const graph = new RouterGraph()

graph.addRoute(c.chemin(), {
    get: async ({ resp }) => {
        resp(new Response("Hello World"))
    },
})

graph.addMiddleware(async ({ unwrapAndRespond }) => {
    console.log("in middleware", await unwrapAndRespond())
})

// const handler = graph.getHandler("", "GET")
// const ctx = handler!({}, new Request("http://localhost:3000/", { method: "GET" }))
// ctx[RouteContext__respond].then((v) =>
// 	console.log("respond event: ", v.toString())
// )
// ctx[RouteContext__block].then((v) => console.log("block event: ", v.toString()))

function fetch(request: Request): Promise<Response> {
    const { promise, resolve, reject } = Promise.withResolvers<Response>()
    const url = new URL(request.url)
    const handler = graph.getHandler(url.pathname, request.method)
    const ctx = handler!({}, request)
    ctx[RouteContext__respond].then(v => {
        v.match(
            async v => resolve(v),
            async () => {
                reject((await ctx[RouteContext__block]).unwrapErr())
            }
        )
    })
    ctx[RouteContext__block].then(v => {
        v.match(v => v, e => {
            if(ctx[RouteContext__respond_channel].resolved) {
                throw e
            }
        })
    })
    return promise;
}

export default { fetch }

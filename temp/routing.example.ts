import RouterGraph from "@/graph/RouterGraph.ts"
import c from "@/export/chemin.ts"
import {
	RouteContext__block,
	RouteContext__respond,
} from "@/ctx/RouteContext.ts"
import { Err } from "@/export/result.ts"

const graph = new RouterGraph()

graph.addRoute_type0(c.chemin(), {
	GET: async ({ resp }) => {
		resp(new Response("Hello World"))
	},
})

graph.addRoute_type0(c.chemin("1"), {
	GET: async (ctx) => {
		// This handler errors out before returning a response

		throw new Error("oh something weird happened")
		// respond event: None
		// block event: Err(Error("oh something weird happened"))
	},
})

graph.addRoute_type0(c.chemin("2"), {
	GET: async (ctx) => {
		ctx.resp(new Response("yay!"))
		// respond event: Some(Resonse("yay!"))
		// block event: Ok
	},
})

graph.addRoute_type0(c.chemin("3"), {
	GET: async (ctx) => {
		ctx.resp(new Response("yay!"))
		// respond event: Some(Resonse("yay!"))
		// middlewarectx.next() promise resolves here
		console.log(ctx)
		ctx[RouteContext__block].push(
			Err(new Error("Happens after response production")),
		)
		console.log(ctx)
		// block event: Err(Error("Happens after response production"))
		// middlewarectx.block() promise resolves here
		// handle this case however you want,
		// if block event is passed to the router with an error
		// it is rethrown and the app will crash
	},
})

graph.addRoute_type0(c.chemin("4"), {
	GET: async (ctx) => {
		// respond event: None
		// block event: Err(HandlerDidntRespond)

		// handle this case however you want,
		// if respond event is passed to the router with `None`
		// the app responds with a 500 error and prints a warning
	},
})

graph.addRoute_type0(c.chemin("5"), {
	GET: async (ctx) => {
		setTimeout(() => {
			ctx.resp(new Response("yay!"))
			// 4. (cancelled) respond event: Response("yay!")
		}, 300)
		// 1. (cancelled) block event: Ok
		// 2. respond event: None
		// 3. block event: Err(HandlerDidntRespond)

		// if block event is fired before respond event (handler exits BEFORE responding),
		// the event is cancelled and replaced with a HandlerDidntRespond Error

		// the route below is the intended way to do something like this
	},
})

graph.addRoute_type0(c.chemin("6"), {
	GET: async (ctx) => {
		const { resolve, promise } = Promise.withResolvers()
		setTimeout(resolve, 300)
		await promise
		ctx.resp(new Response("yay!"))
		// respond event: Some(Resonse("yay!"))
		// block event: Ok

		// the intended way to do delayed responses is with aysnc code
		// so that the block doesn't end before the respond event is fired
	},
})

graph.addMiddleware(async ({ unwrapAndRespond }) => {
	console.log("in middleware", await unwrapAndRespond())
})

// const handler = graph.GETHandler("", "GET")
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
	ctx[RouteContext__respond].promise.then(async (v) => {
		console.log("respond event: ", v)
		await v.match(
			async (v) => resolve(v),
			async () => {
				reject((await ctx[RouteContext__block].promise).unwrapErr())
			},
		)
	})
	ctx[RouteContext__block].promise.then((v) => {
		console.log("block event: ", v.toString())
		v.match(
			(v) => v,
			(e) => {
				console.log(e)
				if (ctx[RouteContext__respond].resolved) {
					throw e
				} else {
					reject(e)
				}
			},
		)
	})
	return promise
}

const response = await fetch(
	new Request("http://localhost:3000/3", { method: "GET" }),
)
console.log(response)

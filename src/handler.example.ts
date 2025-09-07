import RouteContext, {
	RouteContext__block,
	RouteContext__respond,
} from "./ctx/RouteContext.ts"
import type { Data, Params } from "./export/types.ts"

const wait = async (ms: number) => {
	const { resolve, promise } = Promise.withResolvers()
	setTimeout(resolve, ms)
	return promise
}

function someFunctionWithACallback(
	data: string,
	callback: (data: string, dataAgain: string) => void,
) {
	callback(data, "some other data")
}

const handler = RouteContext.useRouteHandler(async (ctx) => {
	ctx.resp(new Response("yay!"))
	// respond event: Some(Resonse("yay!"))
	// middlewarectx.next() promise resolves here
	ctx.ok()
	// block event: Ok
	// middlewarectx.block() promise resolves here
	throw new Error("Happens after block event")

	// this error is caught and warned but otherwise ignored
	// as .ok() basically tells wooter that the handler is done
	// and anything that happens afterward should be ignored
}, {})

const ctx = handler({}, new Request("http://localhost:3000"))

ctx[RouteContext__respond].then((v) =>
	console.log("respond event: ", v.toString())
)
ctx[RouteContext__block].then((v) => console.log("block event: ", v.toString()))

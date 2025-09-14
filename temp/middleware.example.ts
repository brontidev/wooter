import MiddlewareContext from "@/ctx/MiddlewareContext.ts"
import RouteContext, { RouteContext__block, RouteContext__respond, type RouteHandler } from "@/ctx/RouteContext.ts"
import { parse, serialize, type SerializeOptions } from "npm:cookie"
import type { Params } from "@@/types.ts"

const handlerInput: RouteHandler<Params, { cookies: Cookies }> = async (
	ctx,
) => {
	ctx.data.get("cookies").set("hi", "hello")
	ctx.resp(new Response(await ctx.request.text()))
}

const routeHandler = RouteContext.useRouteHandler(handlerInput, { hi: "ello" })

type Cookies = {
	get(name: string): string | undefined
	getAll(): Record<string, string | undefined>
	delete(name: string): void
	set(name: string, value: string, options?: Partial<SerializeOptions>): void
}

const middlewareHandler = MiddlewareContext.useMiddlewareHandler(
	async ({ request, unwrap, resp }) => {
		const cookieHeader = request.headers.get("cookie") || ""
		const parsedCookies = parse(cookieHeader)
		const cookieMap: Record<
			string,
			{ value: string; opts?: Partial<SerializeOptions> }
		> = {}

		const cookies: Cookies = {
			get: (name: string) => cookieMap[name].value ?? parsedCookies[name],
			getAll: () =>
				Object.fromEntries(
					Object.entries(parsedCookies).concat(
						Object.entries(cookieMap).map(([name, { value }]) => {
							return [name, value]
						}),
					),
				),
			delete: (name: string) => {
				cookieMap[name] = { value: "", opts: { maxAge: 0 } }
			},
			set: (
				name: string,
				value: string,
				options?: Partial<SerializeOptions>,
			) => {
				cookieMap[name] = { value, opts: options }
			},
		}

		const response = await unwrap({ cookies })

		const newCookies = Object.entries(cookieMap)
			.map(([name, cookie]) =>
				serialize(name, cookie.value || "", {
					...cookie.opts,
					httpOnly: true,
					secure: true,
				})
			)

		if (newCookies.length > 0) {
			const newResponse: Response = response.clone()
			newCookies.forEach((cookie) => {
				newResponse.headers.append("Set-Cookie", cookie)
			})

			return resp(newResponse)
		}

		resp(response)
	},
	{},
	routeHandler,
)

const ctx = middlewareHandler(
	{},
	new Request("http://localhost:3000", { method: "POST", body: "hi" }),
)
const response = ctx[RouteContext__respond].promise
ctx[RouteContext__block].promise.then((v) => console.log("block event: ", v.toString()))
console.log((await response).unwrap())
console.log(await (await response).unwrap().text())

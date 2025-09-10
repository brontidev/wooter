import { TChemin } from "@dldc/chemin"
import RouterGraph, { MethodDefinitionInput, MethodDefinitions } from "./graph/RouterGraph.ts"
import { Data, Methods, MiddlewareHandler, Params, RouteHandler } from "./export/types.ts"
import { Merge } from "./types.ts"
import c from "./export/chemin.ts"
import { RouteContext__block, RouteContext__respond } from "./ctx/RouteContext.ts"

export class Wooter<TData extends Data, TParentParams extends Params = Params> {
	protected graph: RouterGraph

	constructor(protected basePath: TChemin<TParentParams> = c.chemin() as unknown as TChemin<TParentParams>) {
		this.graph = new RouterGraph()
	}

	route<TParams extends Params>(
		path: TChemin<TParams>,
		method: MethodDefinitionInput,
		handler: RouteHandler<Merge<TParams, TParentParams>, TData>,
	): this
	route<TParams extends Params>(path: TChemin<TParams>, handlers: MethodDefinitions<Merge<TParams, TParentParams>, TData>): this
	route<TParams extends Params>(
		path: TChemin<TParams>,
		methodORHandlers: MethodDefinitionInput | MethodDefinitions<Merge<TParams, TParentParams>, TData>,
		handler?: RouteHandler<Merge<TParams, TParentParams>, TData>,
	): this {
		// @ts-ignore:
		path = c.chemin(this.basePath, path)
		if ((typeof methodORHandlers == "string" || Array.isArray(methodORHandlers))) {
			if (!handler) throw new TypeError()
			if (methodORHandlers === "*") {
				this.graph.addRoute_type1(path, handler)
			} else {
				const methods = [methodORHandlers].flat()
				this.graph.addRoute_type2(path, handler, methods)
			}
		} else {
			const handlers: MethodDefinitions<Merge<TParams, TParentParams>, TData> = methodORHandlers
			this.graph.addRoute_type0(path, handlers)
		}
		return this
	}

	use<TNextData extends Data = Data>(
		handler: MiddlewareHandler<Params, TData, TNextData>,
	): Wooter<Merge<TData, TNextData>, TParentParams> {
		this.graph.addMiddleware(handler)
		return this as unknown as Wooter<Merge<TData, TNextData>, TParentParams>
	}

	router<TParams extends Params>(path: TChemin<TParams>): Wooter<TData, Merge<TParams, TParentParams>> {
		const router = new Wooter<TData, Merge<TParams, TParentParams>>(
			c.chemin(this.basePath, path) as unknown as TChemin<Merge<TParams, TParentParams>>,
		)
		this.graph.addNamespace(router.graph)
		return router
	}

	readonly fetch = async (request: Request): Promise<Response> => {
		const { promise, resolve, reject } = Promise.withResolvers<Response>()
		const url = new URL(request.url)
		const handler = this.graph.getHandler(url.pathname, request.method)
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
}

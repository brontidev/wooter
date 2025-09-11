import type { TChemin, TEmptyObject } from "@dldc/chemin"
import RouterGraph, { type MethodDefinitionInput, type MethodDefinitions } from "@/graph/RouterGraph.ts"
import type { Data, MiddlewareHandler, Params, RouteHandler } from "@/export/types.ts"

import type { Merge } from "@/types.ts"
import c from "@/export/chemin.ts"
import RouteContext, { RouteContext__block, RouteContext__respond } from "@/ctx/RouteContext.ts"

type MergeData<A extends Data | undefined, B extends Data | undefined> = A extends undefined ? B
	: (B extends undefined ? A : Merge<A, B>)
type MergeParams<A extends Params | undefined, B extends Params | undefined> = A extends undefined ? B
	: (B extends undefined ? A : Merge<A, B>)

/**
 * Router class
 */
export default class Wooter<TData extends Data | undefined = undefined, TParentParams extends Params | undefined = undefined> {
	private graph: RouterGraph
	private notFoundHandler?: RouteHandler<TEmptyObject>

	constructor(private basePath: TChemin<TParentParams> = c.chemin() as unknown as TChemin<TParentParams>) {
		this.graph = new RouterGraph()
	}

	route<TParams extends Params>(
		path: TChemin<TParams>,
		method: MethodDefinitionInput,
		handler: RouteHandler<MergeParams<TParams, TParentParams>, TData>,
	): this
	route<TParams extends Params>(path: TChemin<TParams>, handlers: MethodDefinitions<Merge<TParams, TParentParams>, TData>): this
	route<TParams extends Params>(
		path: TChemin<TParams>,
		methodORHandlers: MethodDefinitionInput | MethodDefinitions<Merge<TParams, TParentParams>, TData>,
		handler?: RouteHandler<MergeParams<TParams, TParentParams>, TData>,
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

	use<TNextData extends Data | undefined = undefined>(
		handler: MiddlewareHandler<Params, TData, TNextData extends undefined ? TEmptyObject : TNextData>,
	): Wooter<MergeData<TData, TNextData>, TParentParams> {
		this.graph.addMiddleware(handler)
		return this as unknown as Wooter<MergeData<TData, TNextData>, TParentParams>
	}

	router<TParams extends Params>(path: TChemin<TParams>): Wooter<TData, Merge<TParams, TParentParams>> {
		const router = new Wooter<TData, Merge<TParams, TParentParams>>(
			c.chemin(this.basePath, path) as unknown as TChemin<Merge<TParams, TParentParams>>,
		)
		this.graph.addNamespace(router.graph)
		return router
	}

	notFound(handler: RouteHandler<TEmptyObject>): this {
		this.notFoundHandler = handler
		return this
	}

	readonly fetch = (request: Request): Promise<Response> => {
		const url = new URL(request.url)
		let handler = this.graph.getHandler(url.pathname, request.method)
		if (!handler) {
			handler = RouteContext.useRouteHandler(
				this.notFoundHandler ?? (async ({ resp, url }) => resp(new Response(`Not found ${request.method} ${url.pathname}`, { status: 404 }))),
				{},
			)
		}

		return RouterGraph.runHandler(handler, request)
	}
}

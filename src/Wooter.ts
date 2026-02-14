import type { TChemin, TEmptyObject } from "@dldc/chemin"
import RouterGraph, { type MethodDefinitionInput, type MethodDefinitions } from "@/graph/RouterGraph.ts"
import type { Data, MiddlewareHandler, OptionalMerge, Params, RouteHandler } from "@@/types.ts"

import type { Merge } from "@/types.ts"
import c from "@@/chemin.ts"
import RouteContext from "@/ctx/RouteContext.ts"

type KeysSubset<U, T> = Exclude<keyof U, keyof T> extends never ? unknown : never

/**
 * Router class
 */
export default class Wooter<TData extends Data | undefined = undefined, TParentParams extends Params | undefined = undefined> {
	private graph: RouterGraph
	#notFoundHandler?: RouteHandler<TEmptyObject>

	/**
	 * @internal
	 */
	private get notFoundHandler(): RouteHandler<TEmptyObject> {
		return this.#notFoundHandler ??
			(({ resp, url, request }) => resp(new Response(`Not found ${request.method} ${url.pathname}`, { status: 404 })))
	}

	/**
	 * Router class
	 */
	constructor(private basePath: TChemin<TParentParams> = c.chemin() as unknown as TChemin<TParentParams>) {
		this.graph = new RouterGraph()
	}

	/**
	 * Defines a route with a single path and a method or multiple methods
	 *
	 * @example
	 * ```ts
	 * wooter.route(c.chemin(), "GET", ctx => ...)
	 * ```
	 * @example
	 * ```ts
	 * wooter.route(c.chemin(), ["GET", "POST"], ctx => ...)
	 * ```
	 * @param path Path
	 * @param method HTTP method
	 * @param handler Handler
	 */
	route<TParams extends Params>(
		path: TChemin<TParams>,
		method: MethodDefinitionInput,
		handler: RouteHandler<OptionalMerge<Params, TParams, TParentParams>, TData>,
	): this
	/**
	 * Defines multiple routes for one path with different methods
	 *
	 * @example
	 * ```ts
	 * wooter.route(c.chemin(), { GET: ctx => ..., POST: ctx => ... })
	 * // wet throat
	 * ```
	 *
	 * @param path Path
	 * @param handlers Map of method -> handler
	 */
	route<TParams extends Params>(path: TChemin<TParams>, handlers: MethodDefinitions<Merge<TParams, TParentParams>, TData>): this
	/**
	 * Defines a route
	 *
	 * @param path Path
	 * @param methodOrHandlers
	 * @param handler Handler
	 */
	route<TParams extends Params>(
		path: TChemin<TParams>,
		methodOrHandlers: MethodDefinitionInput | MethodDefinitions<Merge<TParams, TParentParams>, TData>,
		handler?: RouteHandler<OptionalMerge<Params, TParams, TParentParams>, TData>,
	): this {
		const wholePath = c.chemin(this.basePath, path)
		if (typeof methodOrHandlers == "string" || Array.isArray(methodOrHandlers)) {
			if (!handler) throw new TypeError()
			if (methodOrHandlers === "*") {
				this.graph.addRoute_wildcardMethod(wholePath, handler)
			} else {
				const methods = new Set([methodOrHandlers].flat())
				this.graph.addRoute_withMethodSet(wholePath, handler, methods)
			}
		} else {
			this.graph.addRoute_withMethodMap(
				wholePath,
				methodOrHandlers as MethodDefinitions<Merge<TParams, TParentParams>, TData>,
			)
		}
		return this
	}

	/**
	 * Applies middleware to a wooter
	 * @param handler middleware to apply
	 * @return wooter with new types
	 *
	 * @ignore
	 */
	use<TNextData extends Data | undefined = undefined>(
		handler: MiddlewareHandler<Params, TData, TNextData>,
	): Wooter<OptionalMerge<Data, TData, TNextData>, TParentParams>

	/**
	 * Applies middleware to a wooter
	 * @param handler middleware to apply
	 * @return wooter with new types
	 *
	 * @ignore
	 */
	// for .use-ing standalone middleware
	use<
		TNextData extends Data | undefined = undefined,
		THandlerInputData extends Data & KeysSubset<THandlerInputData, TData> | undefined = undefined,
	>(
		handler: MiddlewareHandler<Params, THandlerInputData, TNextData>,
	): Wooter<OptionalMerge<Data, TData, TNextData>, TParentParams>

	/**
	 * Applies middleware to a wooter
	 * @param handler middleware to apply
	 * @return wooter with new types
	 */
	use<TNextData extends Data | undefined = undefined>(
		handler: MiddlewareHandler<Params, TData, TNextData>,
	): Wooter<OptionalMerge<Data, TData, TNextData>, TParentParams> {
		this.graph.addMiddleware(handler)
		return this as unknown as Wooter<OptionalMerge<Data, TData, TNextData>, TParentParams>
	}

	/**
	 * Returns Wooter with basePath
	 * > Any routes applied to the new wooter are
	 * > routed through this one
	 */
	router<TParams extends Params>(basePath: TChemin<TParams>): Wooter<TData, Merge<TParams, TParentParams>> {
		const router = new Wooter<TData, Merge<TParams, TParentParams>>(
			c.chemin(this.basePath, basePath) as unknown as TChemin<Merge<TParams, TParentParams>>,
		)
		this.graph.addNamespace(router.graph)
		return router
	}

	/**
	 * Registers notFound handler
	 */
	notFound(handler: RouteHandler<TEmptyObject>): this {
		this.#notFoundHandler = handler
		return this
	}

	/**
	 * Sends a request to the wooter
	 */
	readonly fetch = (request: Request): Promise<Response> => {
		const url = new URL(request.url)
		let handler = this.graph.getHandler(url.pathname, request.method)
		if (!handler) {
			handler = RouteContext.useRouteHandler(
				this.notFoundHandler,
				{},
			)
		}

		return RouterGraph.runHandler(handler, request)
	}
}

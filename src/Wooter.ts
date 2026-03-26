import type { TChemin, TEmptyObject } from "@@/chemin.ts"
import RouterGraph, { type MethodDefinitionInput, type MethodDefinitions } from "@/graph/RouterGraph.ts"
import type { Data, MiddlewareHandler, OptionalMerge, Params, RouteHandler } from "@@/types.ts"

import type { Merge } from "@/types.ts"
import c from "@@/chemin.ts"
import RouteContext, { RouteContext__execution, RouteContext__respond } from "@/ctx/RouteContext.ts"
import { strayErrorStore } from "@/WooterError.ts"

type KeysSubset<U, T> = Exclude<keyof U, keyof T> extends never ? unknown : never

/**
 * Typed HTTP router with composable middleware and nested route namespaces.
 *
 * @typeParam TData Middleware-provided data available on every handler context.
 * @typeParam TParentParams Params inherited from parent routers.
 */
export default class Wooter<TData extends Data | undefined = undefined, TParentParams extends Params | undefined = undefined> {
	private graph: RouterGraph
	#notFoundHandler?: RouteHandler<TEmptyObject>

	/**
	 * Returns the registered 404 handler, or a default fallback when none is set.
	 *
	 * @internal
	 */
	private get notFoundHandler(): RouteHandler<TEmptyObject> {
		return this.#notFoundHandler ??
			(({ resp, url, request }) => resp(new Response(`Not found ${request.method} ${url.pathname}`, { status: 404 })))
	}

	/**
	 * Creates a new router instance.
	 *
	 * @param basePath Optional base path prepended to all routes registered on this instance.
	 * @param catchStrayErrors Error sink used for asynchronous errors that occur after a response was already sent.
	 */
	constructor(
		private basePath: TChemin<TParentParams> = c.chemin() as unknown as TChemin<TParentParams>,
		protected catchStrayErrors: (e: unknown) => void = (e) => {
			throw e
		},
	) {
		this.graph = new RouterGraph()
	}

	/**
	 * Registers one handler for one method, many methods, or all methods (`"*"`) on a path.
	 *
	 * @example
	 * ```ts
	 * router.route(c.chemin("/users"), "GET", (ctx) => ctx.resp("ok"))
	 * ```
	 *
	 * @example
	 * ```ts
	 * router.route(c.chemin("/users"), ["GET", "POST"], (ctx) => ctx.resp("ok"))
	 * ```
	 *
	 * @param path Typed route path.
	 * @param method Allowed method, methods, or `"*"` wildcard.
	 * @param handler Route handler invoked for matching requests.
	 * @returns The current router instance for chaining.
	 */
	route<TParams extends Params>(
		path: TChemin<TParams>,
		method: MethodDefinitionInput,
		handler: RouteHandler<OptionalMerge<Params, TParams, TParentParams>, TData>,
	): this
	/**
	 * Registers per-method handlers for a single path.
	 *
	 * @example
	 * ```ts
	 * router.route(c.chemin("/users"), {
	 *   GET: (ctx) => ctx.resp("list"),
	 *   POST: (ctx) => ctx.resp("create"),
	 * })
	 * ```
	 *
	 * @param path Typed route path.
	 * @param handlers Map of method names to handlers.
	 * @returns The current router instance for chaining.
	 */
	route<TParams extends Params>(path: TChemin<TParams>, handlers: MethodDefinitions<Merge<TParams, TParentParams>, TData>): this
	/**
	 * Registers a route definition on this router.
	 *
	 * @param path Typed route path.
	 * @param methodOrHandlers Method selector(s) or method-to-handler map.
	 * @param handler Handler used when `methodOrHandlers` is method-based.
	 * @returns The current router instance for chaining.
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
	 * Adds middleware that can enrich context data for downstream handlers.
	 *
	 * @param handler Middleware to run before route handlers.
	 * @returns A typed router view whose `data` reflects middleware output.
	 *
	 * @ignore
	 */
	use<TNextData extends Data | undefined = undefined>(
		handler: MiddlewareHandler<Params, TData, TNextData>,
	): Wooter<OptionalMerge<Data, TData, TNextData>, TParentParams>

	/**
	 * Adds middleware authored against a narrower input data shape.
	 *
	 * @param handler Middleware to run before route handlers.
	 * @returns A typed router view whose `data` reflects middleware output.
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
	 * Adds middleware to this router.
	 *
	 * @param handler Middleware to run before matching route handlers.
	 * @returns A typed router view whose `data` includes middleware output.
	 */
	use<TNextData extends Data | undefined = undefined>(
		handler: MiddlewareHandler<Params, TData, TNextData>,
	): Wooter<OptionalMerge<Data, TData, TNextData>, TParentParams> {
		this.graph.addMiddleware(handler)
		return this as unknown as Wooter<OptionalMerge<Data, TData, TNextData>, TParentParams>
	}

	/**
	 * Creates a child router mounted under the current router.
	 *
	 * Routes registered on the returned router are reachable through this router.
	 *
	 * @param basePath Path prefix for the child router.
	 * @returns A new router instance scoped to `basePath`.
	 */
	router<TParams extends Params>(basePath: TChemin<TParams>): Wooter<TData, Merge<TParams, TParentParams>> {
		const router = new Wooter<TData, Merge<TParams, TParentParams>>(
			c.chemin(this.basePath, basePath) as unknown as TChemin<Merge<TParams, TParentParams>>,
		)
		this.graph.addNamespace(router.graph)
		return router
	}

	/**
	 * Registers a fallback handler used when no route matches.
	 *
	 * @param handler Route handler for unmatched requests.
	 * @returns The current router instance for chaining.
	 */
	notFound(handler: RouteHandler<TEmptyObject>): this {
		this.#notFoundHandler = handler
		return this
	}

	/**
	 * Dispatches a request through route matching and middleware execution.
	 *
	 * @param request Incoming request.
	 * @returns Handler response.
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

		const { promise, resolve, reject } = Promise.withResolvers<Response>()
		const ctx = strayErrorStore.run(this.catchStrayErrors, () => handler({}, request))
		const execution = ctx[RouteContext__execution]
		const respond = ctx[RouteContext__respond]

		respond.then(resolve)
		execution.then((result) => {
			result.inspect((err) => {
				reject(err)
			})
		})

	

		return promise
	}
}

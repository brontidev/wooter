import type { TChemin, TEmptyObject } from "@@/chemin.ts"
import RouterGraph, { type MethodDefinitionInput, type MethodDefinitions } from "@/graph/RouterGraph.ts"
import type { MiddlewareHandler, OptionalMerge, Params, RouteHandler, State } from "@@/types.ts"

import type { Merge } from "@/types.ts"
import c from "@@/chemin.ts"
import RouteContext, { RouteContext__execution, RouteContext__respond } from "@/ctx/RouteContext.ts"
import { strayErrorStore } from "@/WooterError.ts"

type KeysSubset<U, T> = Exclude<keyof U, keyof T> extends never ? unknown : never

/**
 * Typed HTTP router with composable middleware and nested route namespaces.
 *
 * @typeParam TState Middleware-provided data available on every handler context.
 * @typeParam TParentParams Params inherited from parent routers.
 */
export default class Wooter<TState extends State | undefined = undefined, TParentParams extends Params | undefined = undefined> {
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
	 * Registers a handler for one or more HTTP methods on a path.
	 *
	 * Routes are matched in registration order. Use this overload for single methods,
	 * arrays of methods, or the wildcard `"*"`.
	 *
	 * @example Register a GET route
	 * ```ts
	 * router.route(c.chemin("users"), "GET", ({ resp }) => {
	 *   resp(Response.json([]))
	 * })
	 * ```
	 *
	 * @example Register multiple methods
	 * ```ts
	 * router.route(c.chemin("users"), ["GET", "POST"], ({ request, resp }) => {
	 *   if (request.method === "GET") resp(Response.json([]))
	 *   else resp(Response.json({}, { status: 201 }))
	 * })
	 * ```
	 *
	 * @typeParam TParams Parameter type inferred from the path.
	 * @param path Typed route path built with Chemin.
	 * @param method HTTP method: string, array of methods, or `"*"` for all.
	 * @param handler Route handler receiving the route context.
	 * @returns The current router for method chaining.
	 * @throws TypeError if handler is not provided with string/array method.
	 */
	route<TParams extends Params>(
		path: TChemin<TParams>,
		method: MethodDefinitionInput,
		handler: RouteHandler<OptionalMerge<Params, TParams, TParentParams>, TState>,
	): this
	/**
	 * Registers different handlers for different HTTP methods on the same path.
	 *
	 * This overload accepts a method-to-handler map. Omitted methods are not handled.
	 *
	 * @example Register per-method handlers
	 * ```ts
	 * router.route(c.chemin("users"), {
	 *   GET: ({ resp }) => resp(Response.json([])),
	 *   POST: ({ request, resp }) => {
	 *     const body = await request.json()
	 *     resp(Response.json(body, { status: 201 }))
	 *   },
	 * })
	 * ```
	 *
	 * @typeParam TParams Parameter type inferred from the path.
	 * @param path Typed route path built with Chemin.
	 * @param handlers Map of HTTP methods to their handler functions.
	 * @returns The current router for method chaining.
	 */
	route<TParams extends Params>(
		path: TChemin<TParams>,
		handlers: MethodDefinitions<Merge<TParams, TParentParams>, TState>,
	): this
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
		methodOrHandlers: MethodDefinitionInput | MethodDefinitions<Merge<TParams, TParentParams>, TState>,
		handler?: RouteHandler<OptionalMerge<Params, TParams, TParentParams>, TState>,
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
				methodOrHandlers as MethodDefinitions<Merge<TParams, TParentParams>, TState>,
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
	use<TNextState extends State | undefined = undefined>(
		handler: MiddlewareHandler<Params, TState, TNextState>,
	): Wooter<OptionalMerge<State, TState, TNextState>, TParentParams>

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
		TNextState extends State | undefined = undefined,
		THandlerInputState extends State & KeysSubset<THandlerInputState, TState> | undefined = undefined,
	>(
		handler: MiddlewareHandler<Params, THandlerInputState, TNextState>,
	): Wooter<OptionalMerge<State, TState, TNextState>, TParentParams>

	/**
	 * Adds middleware to this router.
	 *
	 * @param handler Middleware to run before matching route handlers.
	 * @returns A typed router view whose `data` includes middleware output.
	 */
	use<TNextState extends State | undefined = undefined>(
		handler: MiddlewareHandler<Params, TState, TNextState>,
	): Wooter<OptionalMerge<State, TState, TNextState>, TParentParams> {
		this.graph.addMiddleware(handler)
		return this as unknown as Wooter<OptionalMerge<State, TState, TNextState>, TParentParams>
	}

	/**
	 * Creates a child router mounted under the current router.
	 *
	 * Routes registered on the returned router are reachable through this router.
	 *
	 * @param basePath Path prefix for the child router.
	 * @returns A new router instance scoped to `basePath`.
	 */
	branch<TParams extends Params>(basePath: TChemin<TParams>): Wooter<TState, Merge<TParams, TParentParams>> {
		const router = new Wooter<TState, Merge<TParams, TParentParams>>(
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
	 * Handles a request through middleware and route matching.
	 *
	 * This is the entry point to the router. Export it directly to an HTTP server.
	 *
	 * @example Use with Deno
	 * ```ts
	 * export default app
	 * // Or serve directly: Deno.serve(app.fetch)
	 * ```
	 *
	 * @param request The incoming HTTP request.
	 * @returns A promise resolving to the HTTP response.
	 * @throws On framework errors (handler didn't respond, responded twice, etc.).
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

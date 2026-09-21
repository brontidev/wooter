import type { EmptyObject } from "@@/types.ts"
import type { MethodDefinitionInput, MethodDefinitions } from "@/graph/Graph.ts"
import type { MiddlewareHandler, OptionalMerge, Params, RouteHandler, State } from "@@/types.ts"

import type { Merge } from "@/types.ts"
import RouteContext, { RouteContext__execution, RouteContext__respond } from "@/ctx/RouteContext.ts"
import { strayErrorStore } from "@/WooterError.ts"
import { Graph } from "@/graph/Graph.ts"
import type { ParamsOfPath, Path } from "@/path/types.ts"

type KeysSubset<U, T> = Exclude<keyof U, keyof T> extends never ? unknown : never

/**
 * Typed HTTP router with composable middleware and nested route namespaces.
 *
 * @typeParam TState Middleware-provided data available on every handler context.
 * @typeParam TParentParams Params inherited from parent routers.
 */
export default class Wooter<
	TState extends State | undefined = undefined,
	BasePath extends Path = Path,
	TParentParams extends Params | undefined = ParamsOfPath<BasePath>,
> {
	private graph: Graph
	#notFoundHandler?: RouteHandler<EmptyObject>

	/**
	 * Returns the registered 404 handler, or a default fallback when none is set.
	 *
	 * @internal
	 */
	private get notFoundHandler(): RouteHandler<EmptyObject> {
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
		basePath?: BasePath,
		protected catchStrayErrors: (e: unknown) => void = (e) => {
			throw e
		},
	) {
		this.graph = new Graph(basePath)
	}

	/**
	 * Registers a handler for one or more HTTP methods on a path.
	 *
	 * Routes are matched in registration order. Use this overload for single methods,
	 * arrays of methods, or the wildcard `"*"`.
	 *
	 * @example Register a GET route
	 * ```ts
	 * router.route(p.path("users"), "GET", ({ resp }) => {
	 *   resp(Response.json([]))
	 * })
	 * ```
	 *
	 * @example Register multiple methods
	 * ```ts
	 * router.route(p.path("users"), ["GET", "POST"], ({ request, resp }) => {
	 *   if (request.method === "GET") resp(Response.json([]))
	 *   else resp(Response.json({}, { status: 201 }))
	 * })
	 * ```
	 *
	 * @typeParam TParams Parameter type inferred from the path.
	 * @param path Typed route path built with the path API.
	 * @param method HTTP method: string, array of methods, or `"*"` for all.
	 * @param handler Route handler receiving the route context.
	 * @returns The current router for method chaining.
	 * @throws TypeError if handler is not provided with string/array method.
	 */
	route<TPath extends Path, TParams extends Record<string, unknown> = ParamsOfPath<TPath>>(
		path: TPath,
		method: MethodDefinitionInput,
		handler: RouteHandler<OptionalMerge<TParams, TParentParams>, TState>,
	): this
	/**
	 * Registers different handlers for different HTTP methods on the same path.
	 *
	 * This overload accepts a method-to-handler map. Omitted methods are not handled.
	 *
	 * @example Register per-method handlers
	 * ```ts
	 * router.route(p.path("users"), {
	 *   GET: ({ resp }) => resp(Response.json([])),
	 *   POST: ({ request, resp }) => {
	 *     const body = await request.json()
	 *     resp(Response.json(body, { status: 201 }))
	 *   },
	 * })
	 * ```
	 *
	 * @typeParam TParams Parameter type inferred from the path.
	 * @param path Typed route path built with the path API.
	 * @param handlers Map of HTTP methods to their handler functions.
	 * @returns The current router for method chaining.
	 */
	route<TPath extends Path, TParams extends Record<string, unknown> = ParamsOfPath<TPath>>(
		path: TPath,
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
	route<TPath extends Path, TParams extends Record<string, unknown> = ParamsOfPath<TPath>>(
		path: TPath,
		methodOrHandlers: MethodDefinitionInput | MethodDefinitions<Merge<TParams, TParentParams>, TState>,
		handler?: RouteHandler<OptionalMerge<TParams, TParentParams>, TState>,
	): this {
		if (typeof methodOrHandlers == "string" || Array.isArray(methodOrHandlers)) {
			if (!handler) throw new TypeError()
			if (methodOrHandlers === "*") {
				this.graph.addRoute_wildcardMethod(path, handler)
			} else {
				const methods = new Set([methodOrHandlers].flat().map((x) => x.toUpperCase()))
				this.graph.addRoute_withMethodSet(path, handler, methods)
			}
		} else {
			this.graph.addRoute_withMethodMap(
				path,
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
	): Wooter<OptionalMerge<TState, TNextState>, BasePath, TParentParams>

	/**
	 * Adds middleware authored against a narrower input data shape.
	 *
	 * @param handler Middleware to run before route handlers.
	 * @returns A typed router view whose `data` reflects middleware output.
	 *
	 * @ignore
	 */
	use<
		TNextState extends State | undefined = undefined,
		THandlerInputState extends State & KeysSubset<THandlerInputState, TState> | undefined = undefined,
	>(
		handler: MiddlewareHandler<Record<string, unknown>, THandlerInputState, TNextState>,
	): Wooter<OptionalMerge<TState, TNextState>, BasePath, TParentParams>

	/**
	 * Adds middleware to this router.
	 *
	 * @param handler Middleware to run before matching route handlers.
	 * @returns A typed router view whose `data` includes middleware output.
	 */
	use<TNextState extends State | undefined = undefined>(
		handler: MiddlewareHandler<Record<string, unknown>, TState, TNextState>,
	): Wooter<OptionalMerge<TState, TNextState>, BasePath, TParentParams> {
		this.graph.addMiddleware(handler)
		return this as unknown as Wooter<OptionalMerge<TState, TNextState>, BasePath, TParentParams>
	}

	/**
	 * Creates a child router mounted under the current router.
	 *
	 * Routes registered on the returned router are reachable through this router.
	 *
	 * @param basePath Path prefix for the child router.
	 * @returns A new router instance scoped to `basePath`.
	 */
	branch<TPath extends Path, TParams extends Record<string, unknown> = ParamsOfPath<TPath>>(
		basePath: TPath,
	): Wooter<TState, BasePath, Merge<TParams, TParentParams>> {
		const router = new Wooter<TState, BasePath, Merge<TParams, TParentParams>>()
		this.graph.addNamespace(basePath, router.graph)
		return router
	}

	/**
	 * Registers a fallback handler used when no route matches.
	 *
	 * @param handler Route handler for unmatched requests.
	 * @returns The current router instance for chaining.
	 */
	notFound(handler: RouteHandler<EmptyObject>): this {
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

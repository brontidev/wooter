import { Event, MiddlewareEvent } from "./event.ts"
import {
	type IChemin,
	type ICheminMatch,
	matchFirst,
	matchFirstExact,
} from "./export/chemin.ts"
import { ExitWithoutResponse, MiddlewareDidntCallUp } from "./export/error.ts"
import type {
	Data,
	Handler,
	MiddlewareHandler,
	Params,
} from "./export/types.ts"
import { promiseState } from "./shared.ts"

export type RouteMatchDefinition = {
	params: Params
	path: string
	handle: Handler
}

export class MethodNotAllowed extends Error {
	override message: string = "MethodNotAllowed"
}

/**
 * Datagraph for wooter's routes
 *
 * TODO: implement namespaces
 * @constructor
 */
export class Graph {
	private routeMatchers = new Map<string, Map<string, IChemin>>()
	private routes = new Map<string, Map<string, Handler>>()

	private middleware = new Set<MiddlewareHandler>()

	private namespaceMatchers = new Map<string, IChemin>()
	private namespaces = new Map<
		string,
		(
			match: ICheminMatch<unknown>,
			method: string,
		) => RouteMatchDefinition | null
	>()

	constructor(private throwOnDuplicate: boolean = true) {}

	/**
	 * Add a route to the graph
	 *
	 * @param method - HTTP method
	 * @param chemin - Chemin path of the route
	 * @param handler - Handler of the route
	 */
	addRoute(
		method: string,
		chemin: IChemin,
		handler: Handler,
	) {
		// method = method.toUpperCase()
		const path = chemin.stringify()
		if (this.routes.has(path) && this.routes.get(path)?.has(method)) {
			if (this.throwOnDuplicate) {
				throw new Error(`Duplicate path detected: ${path}`)
			}
			console.warn(`Duplicate path detected: ${path}`)
		}
		const routeMatcherMap = this.routeMatchers.get(method) ?? new Map()
		routeMatcherMap.set(path, chemin)
		this.routeMatchers.set(method, routeMatcherMap)

		const routeMap = this.routes.get(path) ?? new Map()
		routeMap.set(method, handler)
		this.routes.set(path, routeMap)
	}

	addNamespace(
		chemin: IChemin<unknown>,
		matcher: (
			match: ICheminMatch<unknown>,
			method: string,
		) => RouteMatchDefinition | null,
	) {
		const path = chemin.stringify()

		if (this.namespaceMatchers.has(path)) {
			if (this.throwOnDuplicate) {
				throw new Error(`Duplicate namespace path detected: ${path}`)
			}
			console.warn(`Duplicate namespace path detected: ${path}`)
		}
		this.namespaceMatchers.set(path, chemin)
		this.namespaces.set(path, matcher)
	}

	/**
	 * Add a middleware function to the graph
	 *
	 * @param middleware - middleware function
	 */
	// @ts-expect-error: The generics are not needed here
	pushMiddleware(middleware: MiddlewareHandler<unknown, unknown>) {
		this.middleware.add(middleware)
	}

	private composeMiddleware(
		handler: Handler,
		params: Params,
	): Handler {
		const middleware = this.middleware.values().toArray()

		return (baseEvent) => {
			const data: Data = baseEvent.data
			Object.assign(params, baseEvent.params)
			const createNext = (idx: number) => {
				return (
					nextData: Record<string, unknown>,
					request: Request,
				) => {
					Object.assign(data, nextData)

					if (idx >= middleware.length) {
						const event = new Event(baseEvent.request, params, data)
						handler(event).then(async () => {
							if (
								await promiseState(event.promise) === "pending"
							) {
								return event.err(new ExitWithoutResponse())
							}
						}, (e) => {
							event.err(e)
						})
						return event.promise
					}

					const middlewareHandler = middleware[idx]
					const event = new MiddlewareEvent(
						request,
						params,
						data,
						createNext(idx + 1),
					)

					middlewareHandler(event).then(async () => {
						if (await promiseState(event.promise) === "pending") {
							if (!event.storedResponse) {
								return event.err(new MiddlewareDidntCallUp())
							}
							event.resp(event.storedResponse)
						}
					}, (e) => {
						event.err(e)
					})
					return event.promise
				}
			}
			return createNext(0)(data, baseEvent.request).then(
				baseEvent.resp,
				baseEvent.err,
			)
		}
	}

	/**
	 * Gets a handler from a path and method
	 *
	 * @param pathname - Path name to match
	 * @param method - HTTP method
	 * @returns - Handler and match data
	 */
	getHandler(
		pathname: string | string[],
		method: string,
	): RouteMatchDefinition | null {
		const namespace = matchFirst(
			this.namespaceMatchers.values().toArray(),
			pathname,
		)

		if (!namespace) {
			const routeMatcher = this.routeMatchers.get(method)
			if (!routeMatcher) throw new MethodNotAllowed()
			let route = matchFirstExact(
				routeMatcher.values().toArray(),
				pathname,
			)
			// if chemin is constructed as "" or "/" it will not match.
			if (pathname === "/" && routeMatcher.has("/") && !route) {
				route = { chemin: routeMatcher.get("/")!, params: {} }
			}
			if (!route) return null
			const { chemin, params } = route
			const path = chemin.stringify()
			const pathMethods = this.routes.get(path)
			if (!pathMethods) return null
			if (!pathMethods?.has(method)) throw new MethodNotAllowed()
			const handler = pathMethods.get(method)!

			return {
				params,
				path,
				handle: this.composeMiddleware(handler, params),
			}
		} else {
			const { chemin, match } = namespace
			const { params } = match
			const path = chemin.stringify()
			const handler = this.namespaces.get(path)!(match, method)
			if (!handler) return null
			return {
				params,
				path,
				handle: this.composeMiddleware(handler?.handle, params),
			}
		}
	}
}

import { Event } from "./event.ts"
import { type IChemin, type match, matchFirstExact } from "./export/chemin.ts"
import type { Handler, MiddlewareHandler } from "./export/types.ts"

/**
 * Datagraph for wooter's routes
 *
 * TODO: implement namespaces
 * @constructor
 */
export class Graph {
	private routeMatchers = new Map<string, IChemin>()
	private routes = new Map<string, Map<string, Handler>>()

	private middleware = new Set<MiddlewareHandler>()

	constructor(private throwOnDuplicate: boolean = true) {}

	/**
	 * Add a route to the graph
	 *
	 * @param method - HTTP method
	 * @param chemin - Chemin path of the route
	 * @param handler - Handler of the route
	 */
	addRoute<
		TParams extends Record<string, unknown> = Record<string, unknown>,
		TData extends Record<string, unknown> = Record<string, unknown>,
	>(
		method: string,
		chemin: IChemin<TParams>,
		handler: Handler<TParams, TData>,
	) {
		const path = chemin.stringify()
		if (this.routeMatchers.has(path)) {
			if (this.throwOnDuplicate) {
				throw new Error(`Duplicate path detected: ${path}`)
			}
			console.warn(`Duplicate path detected: ${path}`)
		}
		this.routeMatchers.set(path, chemin)
		const routeMap = this.routes.get(path) ?? new Map()
		routeMap.set(method, handler)
		this.routes.set(path, routeMap)
	}

	/**
	 * Add a middleware function to the graph
	 *
	 * @param middleware - middleware function
	 */
	pushMiddleware(middleware: MiddlewareHandler) {
		this.middleware.add(middleware)
	}

	/**
	 * Gets a handler from a path and method
	 *
	 * @param pathname - Path name to match
	 * @param method - HTTP method
	 * @returns - Handler and match data
	 */
	getHandler(pathname: string, method: string) {
		const route = matchFirstExact(
			this.routeMatchers.values().toArray(),
			pathname,
		)

		if (!route) return null
		const { chemin, params } = route
		const path = chemin.stringify()
		const handler = this.routes.get(path)!.get(method)
		return {
			params,
			path,
			handle: async (request: Request) => {
				const event = new Event(request, params, {})
				try {
					handler!(event)
				} catch (e) {
					event.err(e)
				}
				return event.promise
			},
		}
	}
}

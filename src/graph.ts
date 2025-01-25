import { Event, MiddlewareEvent } from "./event.ts"
import {
	type IChemin,
	type ICheminMatch,
	matchFirst,
	matchFirstExact,
} from "./export/chemin.ts"
import { ExitWithoutResponse, MiddlewareDidntCallUp } from "./export/error.ts"
import type { Handler, MiddlewareHandler } from "./export/types.ts"
import { promiseState } from "./shared.ts"

export type RouteMatchDefinition = {
	params: Record<string, unknown>
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
	private routeMatchers = new Map<string, IChemin>()
	private routes = new Map<string, Map<string, Handler>>()

	private middleware = new Set<MiddlewareHandler>()

	private namespaceMatchers = new Map<string, IChemin>()
	private namespaces = new Map<
		string,
		(match: ICheminMatch<unknown>, method: string) => Handler
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
		handler: Handler<Record<string, unknown>, Record<string, unknown>>,
	) {
		const path = chemin.stringify()
		if (this.routes.has(path) && this.routes.get(path)?.has(method)) {
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

	addNamespace(
		chemin: IChemin<unknown>,
		matcher: (match: ICheminMatch<unknown>, method: string) => Handler,
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
		params: Record<string, unknown>,
	): Handler {
		const middleware = this.middleware.values().toArray()

		return (baseEvent) => {
			const data: Record<string, unknown> = baseEvent.data
			Object.assign(params, baseEvent.params)
			const createNext = (idx: number) => {
				return (nextData: Record<string, unknown>) => {
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
						baseEvent.request,
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
			return createNext(0)(data).then(baseEvent.resp, baseEvent.err)
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
			let route = matchFirstExact(
				this.routeMatchers.values().toArray(),
				pathname,
			)
			// if chemin is constructed as "" or "/" it will not match.
			if (pathname === "/" && this.routeMatchers.has("/") && !route) {
				route = { chemin: this.routeMatchers.get("/")!, params: {} }
			}
			if (!route) return null
			const { chemin, params } = route
			const path = chemin.stringify()
			const pathMethods = this.routes.get(path)
			if (!pathMethods) return null
			if (!pathMethods?.has(method)) throw new MethodNotAllowed()
			const handler = pathMethods.get(method)!

			const composedHandler = this.composeMiddleware(handler, params)
			return {
				params,
				path,
				handle: composedHandler,
			}
		} else {
			const { chemin, match } = namespace
			const { params } = match
			const path = chemin.stringify()
			const handler = this.namespaces.get(path)!(match, method)
			const composedHandler = this.composeMiddleware(handler, params)
			return {
				params,
				path,
				handle: composedHandler,
			}
		}
	}
}

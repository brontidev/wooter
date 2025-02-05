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

export class Graph {
	private routes = new Set<{ path: IChemin<any>, method: string, handler: Handler }>()

	private middleware = new Set<MiddlewareHandler>()

	private namespaces = new Set<
		{
			path: IChemin<any>, matcher: (
				match: ICheminMatch<unknown>,
				method: string,
			) => RouteMatchDefinition | null
		}
	>()

	addRoute(
		method: string,
		path: IChemin,
		handler: Handler,
	) {
		method = method.toUpperCase()

		this.routes.add({
			path,
			method,
			handler
		})
	}

	addNamespace(
		path: IChemin<unknown>,
		matcher: (
			match: ICheminMatch<unknown>,
			method: string,
		) => RouteMatchDefinition | null,
	) {
		this.namespaces.add({
			path,
			matcher,
		})
	}

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

	getHandler(
		pathname: string | string[],
		method: string,
	): RouteMatchDefinition | null {
		// const namespace = matchFirst(
		// 	this.namespaceMatchers.values().toArray(),
		// 	pathname,
		// )

		// if (!namespace) {
		// 	const routeMatcher = this.routeMatchers.get(method)
		// 	if (!routeMatcher) return null
		// 	let route = matchFirstExact(
		// 		routeMatcher.values().toArray(),
		// 		pathname,
		// 	)
		// 	// if chemin is constructed as "" or "/" it will not match.
		// 	if (pathname === "/" && routeMatcher.has("/") && !route) {
		// 		route = { chemin: routeMatcher.get("/")!, params: {} }
		// 	}
		// 	if (!route) return null
		// 	const { chemin, params } = route
		// 	const path = chemin.stringify()
		// 	const pathMethods = this.routes.get(path)
		// 	if (!pathMethods) return null
		// 	if (!pathMethods?.has(method)) return null
		// 	const handler = pathMethods.get(method)!

		// 	return {
		// 		params,
		// 		path,
		// 		handle: this.composeMiddleware(handler, params),
		// 	}
		// } else {
		// 	const { chemin, match } = namespace
		// 	const { params } = match
		// 	const path = chemin.stringify()
		// 	const handler = this.namespaces.get(path)!(match, method)
		// 	if (!handler) return null
		// 	return {
		// 		params,
		// 		path,
		// 		handle: this.composeMiddleware(handler?.handle, params),
		// 	}
		// }
	}
}

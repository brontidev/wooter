import { Event, MiddlewareEvent } from "./event.ts"
import {
	type IChemin,
	type ICheminMatch,
	match,
	matchExact,
	splitPathname,
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
	handle: Handler
}

type ExtractSetType<T> = T extends Set<infer U> ? U : never

export class Graph {
	private routes = new Set<
		{ path: IChemin<Params>; method: string; handler: Handler }
	>()

	private middleware = new Set<MiddlewareHandler>()

	private namespaces = new Set<
		{
			path: IChemin<Params>
			matcher: (
				match: ICheminMatch<Params>,
				method: string,
			) => RouteMatchDefinition | undefined
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
			handler,
		})
	}

	addNamespace(
		path: IChemin<Params>,
		// @ts-expect-error: Suppressing type error due to incompatible types between 'matcher' functions.
		matcher: ExtractSetType<typeof this['namespaces']>['matcher'],
	) {
		this.namespaces.add({
			path,
			matcher,
		})
	}

	pushMiddleware(middleware: MiddlewareHandler) {
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
	): RouteMatchDefinition | undefined {
		const pathParts = Array.isArray(pathname)
			? pathname
			: splitPathname(pathname)

		for (const { path, matcher } of this.namespaces) {
			const matchValue = match(path, pathParts)
			if(!matchValue) continue
			const { params } = matchValue
			const handler = matcher(matchValue, method)
			if (!handler) continue // This namespace doesn't have that full route, ignore
			return {
				params,
				handle: this.composeMiddleware(handler?.handle, params),
			}
		}
		// At this point we haven't found a namespace, we should check our local routes.

		for (const { handler, method: intendedMethod, path } of this.routes) {
			if (method !== intendedMethod) continue // This route isn't the method we want to check for
			const params = matchExact(path, pathParts)
			if (!params) continue
			return {
				params,
				handle: this.composeMiddleware(handler, params),
			}
		}

		return undefined
	}
}

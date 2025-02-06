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
import { promiseResolved } from "./shared.ts"

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
			) => Handler | undefined
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
		// @ts-expect-error: Suppressing type error because namespaces is private but the utility type is local.
		matcher: ExtractSetType<typeof this["namespaces"]>["matcher"],
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
						Promise.resolve().then(async () => {
							try {
								await handler(event)
								if (!await promiseResolved(event.promise)) {
									return event.err(new ExitWithoutResponse())
								}
							} catch (e) {
								event.err(e)
							}
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

					Promise.resolve().then(async () => {
						try {
							await middlewareHandler(event)
							if (
								!await promiseResolved(event.promise)
							) {
								if (!event.storedResponse) {
									return event.err(
										new MiddlewareDidntCallUp(),
									)
								}
								event.resp(event.storedResponse)
							}
						} catch (e) {
							event.err(e)
						}
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
		intendedMethod: string,
	): Handler | undefined {
		const pathParts = Array.isArray(pathname)
			? pathname
			: splitPathname(pathname)

		for (const { path, matcher } of this.namespaces) {
			const matchValue = match(path, pathParts)
			if (!matchValue) continue
			const { params } = matchValue
			const handler = matcher(matchValue, intendedMethod)
			if (!handler) continue // This namespace doesn't have that route, continue to next
			return this.composeMiddleware(handler, params)
		}
		// No route has been found in namespaces, check local routess

		for (const { handler, method, path } of this.routes) {
			if (intendedMethod !== method) continue
			const params = matchExact(path, pathParts)
			if (!params) continue
			return this.composeMiddleware(handler, params)
		}

		return undefined
	}
}

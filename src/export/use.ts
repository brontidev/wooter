// TODO: Create a function that transforms a handler by applying middleware to it on the spot

import type { Data, MiddlewareHandler, OptionalMerge, Params, RouteHandler } from "@@/types.ts"
import MiddlewareContext from "@/ctx/MiddlewareContext.ts"
import RouteContext, { RouteContext__execution, RouteContext__respond } from "@/ctx/RouteContext.ts"

/**
 * Applies middleware directly to a route handler and returns a wrapped handler.
 *
 * @param middlewareHandler Middleware to apply before the handler.
 * @param handler Route handler to wrap.
 * @returns Route handler that executes middleware and then delegates to `handler`.
 */
export default function use<
	NextData extends Data | undefined = undefined,
	BaseData extends Data | undefined = undefined,
	// deno-lint-ignore ban-types
	TParams extends Params = {},
>(
	middlewareHandler: MiddlewareHandler<TParams, BaseData, NextData>,
	handler: RouteHandler<TParams, OptionalMerge<Data, BaseData, NextData>>,
): RouteHandler<TParams, BaseData> {
	return async ({ params: _params, request, data: _data, resp }) => {
		let data = Object.fromEntries(Object.entries(_data))
		const params = Object.fromEntries(_params.entries())
		const internalHandler = MiddlewareContext.useMiddlewareHandler(middlewareHandler, params, (nextData, request) => {
			data = Object.assign(data, nextData)
			return RouteContext.useRouteHandler(handler, params)(data, request)
		})

		const new_ctx = internalHandler(data, request)

		new_ctx[RouteContext__respond].promise.then((r) => resp(r))
		return (await new_ctx[RouteContext__execution].promise).inspect((e) => {
			throw e
		})
	}
}

/**
 * Identity helper used to type middleware declarations.
 *
 * @param handler Middleware handler.
 * @returns The same middleware handler with preserved generic inference.
 *
 * @example
 * ```ts
 * const userAgent = middleware<{ userAgent: string | null }>(async ({ request, next }) => {
 *   await next({ userAgent: request.headers.get("User-Agent") })
 * })
 *
 * router.use(userAgent)
 * ```
 */
export function middleware<
	TNextData extends Data | undefined = undefined,
	TData extends Data | undefined = undefined, // deno-lint-ignore ban-types
	TParams extends Params = {},
>(
	handler: MiddlewareHandler<TParams, TData, TNextData>,
): MiddlewareHandler<TParams, TData, TNextData> {
	return handler
}

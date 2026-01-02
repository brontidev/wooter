// TODO: Create a function that transforms a handler by applying middleware to it on the spot

import type { Data, MiddlewareHandler, OptionalMerge, Params, RouteHandler } from "@@/types.ts"
import MiddlewareContext from "@/ctx/MiddlewareContext.ts"
import RouteContext, { RouteContext__block, RouteContext__respond } from "@/ctx/RouteContext.ts"

/**
 * Applies a middleware directly to a handler, returning a new handler
 * @param middlewareHandler - Middleware to apply
 * @param handler - Handler to apply middleware to
 * @returns Handler - Handler that wraps the handler in the middleware
 */
export default function use<
	TParams extends Params,
	BaseData extends Data,
	NextData extends Data | undefined = undefined,
>(
	middlewareHandler: MiddlewareHandler<TParams, BaseData, NextData>,
	handler: RouteHandler<TParams, OptionalMerge<Data, BaseData, NextData>>,
): RouteHandler<TParams, BaseData> {
	return ({ params: _params, request, data, resp }) => {
		const params = Object.fromEntries(_params.entries())
		const internalHandler = MiddlewareContext.useMiddlewareHandler(middlewareHandler, params, (data, request) => {
			return RouteContext.useRouteHandler(handler, params)(data, request)
		})

		const new_ctx = internalHandler(Object.fromEntries(data.entries()), request)

		new_ctx[RouteContext__respond].promise.then((v) => v.map((r) => resp(r)))
		return new_ctx[RouteContext__block].promise
	}
}

/**
 * Creates & Types a middleware handler
 * @param handler Middleware handler
 *
 * @example
 * ```ts
 * const userAgent = middleware<{ userAgent: string | null }>(async ({ request, unwrapAndRespond }) => {
 *     await unwrapAndRespond({ userAgent: request.headers.get('User-Agent') })
 * })
 *
 * wooter.use(userAgent)
 * ```
 *
 */
export function middleware<TNextData extends Data | undefined = undefined, TData extends Data = Data>(
	handler: MiddlewareHandler<Params, TData, TNextData>,
): MiddlewareHandler<Params, TData, TNextData> {
	return handler
}

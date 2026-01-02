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
	NextData extends Data | undefined = undefined,
	BaseData extends Data | undefined = undefined,
	// deno-lint-ignore ban-types
	TParams extends Params = {},
>(
	middlewareHandler: MiddlewareHandler<TParams, BaseData, NextData>,
	handler: RouteHandler<TParams, OptionalMerge<Data, BaseData, NextData>>,
): RouteHandler<TParams, BaseData> {
	return async ({ params: _params, request, data: _data, resp }) => {
		let data = Object.fromEntries(_data.entries())
		const params = Object.fromEntries(_params.entries())
		const internalHandler = MiddlewareContext.useMiddlewareHandler(middlewareHandler, params, (nextData, request) => {
			data = Object.assign(data, nextData)
			return RouteContext.useRouteHandler(handler, params)(data, request)
		})

		const new_ctx = internalHandler(data, request)

		new_ctx[RouteContext__respond].promise.then((v) => v.map((r) => resp(r)))
		return (await new_ctx[RouteContext__block].promise).inspectErr(e => { throw e })
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
 */
export function middleware<TNextData extends Data | undefined = undefined, TData extends Data | undefined = undefined, 	// deno-lint-ignore ban-types
	TParams extends Params = {},>(
	handler: MiddlewareHandler<TParams, TData, TNextData>,
): MiddlewareHandler<TParams, TData, TNextData> {
	return handler
}

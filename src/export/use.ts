// TODO: Create a function that transforms a handler by applying middleware to it on the spot

import type { MiddlewareHandler, OptionalMerge, Params, RouteHandler, State } from "@@/types.ts"
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
	NextState extends State | undefined = undefined,
	BaseState extends State | undefined = undefined,
	// deno-lint-ignore ban-types
	TParams extends Params = {},
>(
	middlewareHandler: MiddlewareHandler<TParams, BaseState, NextState>,
	handler: RouteHandler<TParams, OptionalMerge<State, BaseState, NextState>>,
): RouteHandler<TParams, BaseState> {
	return async ({ params: _params, request, state: _data, resp }) => {
		let data = Object.fromEntries(Object.entries(_data))
		const params = Object.fromEntries(_params.entries())
		const internalHandler = MiddlewareContext.useMiddlewareHandler(middlewareHandler, params, (nextState, request) => {
			data = Object.assign(data, nextState)
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
	TNextState extends State | undefined = undefined,
	TState extends State | undefined = undefined, // deno-lint-ignore ban-types
	TParams extends Params = {},
>(
	handler: MiddlewareHandler<TParams, TState, TNextState>,
): MiddlewareHandler<TParams, TState, TNextState> {
	return handler
}

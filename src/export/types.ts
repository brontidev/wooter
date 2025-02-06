import type { Event, MiddlewareEvent } from "../event.ts"
import type { Merge } from "../util_types.ts"
import type { Wooter } from "../wooter.ts"
import type { IChemin } from "./chemin.ts"

/**
 * HTTP Methods
 */
export type HttpMethod =
	| "GET"
	| "HEAD"
	| "PUT"
	| "PATCH"
	| "POST"
	| "DELETE"


/**
 * Parameters
 */
export type Params = Record<string, unknown>

/**
 * Route data
 */
// deno-lint-ignore no-explicit-any
export type Data = Record<keyof any, unknown>

/**
 * Handler for routes
 *
 * @param event Event
 * @returns Empty promise
 */
export type Handler<
	TParams extends Params = Params,
	TData extends Data = Data,
> = (event: Event<TParams, TData>) => Promise<void> | void
/**
 * Standalone Middleware Handler type
 */
export type StandaloneMiddlewareHandler<
	TNextData extends Data | undefined = Data,
	TData extends Data = Data,
> = MiddlewareHandler<Params, TData, TNextData>

/**
 * Handler for middleware
 *
 * @param event Event
 * @returns Empty promise
 */
export type MiddlewareHandler<
	TParams extends Params = Params,
	TData extends Data = Data,
	TNextData extends Data | undefined = Data,
> = (event: MiddlewareEvent<TParams, TData, TNextData>) => Promise<void> | void

/**
 * A Wooter with HTTP verb method functions
 */
export type WooterWithMethods<
	TData extends Data | undefined = undefined,
	BaseParams extends Params = Params,
> =
	& {
		use<NewData extends Data | undefined = undefined>(
			handler: MiddlewareHandler<
				BaseParams,
				TData extends undefined ? Data : TData,
				NewData
			>,
		): WooterWithMethods<
			TData extends undefined ? NewData
				: NewData extends undefined ? TData
				: {
					[K in keyof Merge<TData, NewData>]: Merge<TData, NewData>[K]
				},
			BaseParams
		>
	}
	& Wooter<TData, BaseParams>
	& Methods<TData extends undefined ? Data : TData, BaseParams>

/**
 * Registers a route to the wooter
 * @param path chemin
 * @param handler route handler
 */
export type WooterAddRoute<
	TData extends Data = Data,
	BaseParams extends Params = Params,
> = <TParams extends Params = Params>(
	path: IChemin<TParams>,
	handler: Handler<TParams & BaseParams, TData>,
) => WooterWithMethods<TData, BaseParams>

/**
 * Object map of HTTP verb method functions
 */
/**
 * Object map of HTTP verb method functions
 */
export type Methods<
	TData extends Data = Data,
	BaseParams extends Params = Params,
	AddRoute = WooterAddRoute<TData, BaseParams>
> = Record<HttpMethod, AddRoute> & Record<Uppercase<string>, AddRoute>
/**
 * Registers a method to the route
 * @param handler route handler
 */
export type RouteAddRoute<
	TData extends Data = Data,
	TParams extends Params = Params,
> = (
	handler: Handler<TParams, TData>,
) => MethodsNoPath<TData, TParams>

/**
 * Object map of HTTP verb method functions with no path
 */
export type MethodsNoPath<
	TData extends Data = Data,
	TParams extends Params = Params,
> = Record<HttpMethod, RouteAddRoute<TData, TParams>>

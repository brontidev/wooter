import type { Event, MiddlewareEvent } from "../event.ts"
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
	| Uppercase<string>

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
> = (event: Event<TParams, TData>) => Promise<void>

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
> = (event: MiddlewareEvent<TParams, TData, TNextData>) => Promise<void>


/**
 * A Wooter with HTTP verb method functions
 */
export type WooterWithMethods<
	TData extends Data = Data,
	BaseParams extends Params = Params,
> = {
	use<NewData extends Data | undefined = undefined>(
		handler: MiddlewareHandler<BaseParams, TData, NewData>,
	): WooterWithMethods<NewData extends undefined ? TData : Omit<TData, keyof NewData> & NewData, BaseParams>
} & Wooter<TData, BaseParams> & Methods<TData, BaseParams>
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
> = Record<HttpMethod, WooterAddRoute<TData, BaseParams>>
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
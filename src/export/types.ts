import type { RouteEvent } from "@/event/index.ts"
import type { MiddlewareEvent } from "@/event/middleware.ts"
import type { Wooter } from "@/wooter.ts"
import type { IChemin } from "@/export/chemin.ts"

/**
 * @internal
 * https://stackoverflow.com/a/49683575/15910952
 */
type OptionalPropertyNames<T> = {
	// deno-lint-ignore ban-types
	[K in keyof T]-?: ({} extends { [P in K]: T[K] } ? K : never)
}[keyof T]

/**
 * @internal
 * https://stackoverflow.com/a/49683575/15910952
 */
type SpreadProperties<L, R, K extends keyof L & keyof R> = {
	[P in K]: L[P] | Exclude<R[P], undefined>
}

/**
 * @internal
 * https://stackoverflow.com/a/49683575/15910952
 */
type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never

/**
 * @internal
 * https://stackoverflow.com/a/49683575/15910952
 */
export type Merge<L, R> = Id<
	& Pick<L, Exclude<keyof L, keyof R>>
	& Pick<R, Exclude<keyof R, OptionalPropertyNames<R>>>
	& Pick<R, Exclude<OptionalPropertyNames<R>, keyof L>>
	& SpreadProperties<L, R, OptionalPropertyNames<R> & keyof L>
>

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
> = (event: RouteEvent<TParams, TData>) => Promise<void> | void
/**
 * Standalone Middleware Handler type
 */
export type StandaloneMiddlewareHandler<
	TNextData extends Data | undefined = undefined,
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
		use<
			NewData extends Data | undefined = undefined,
		>(
			handler: MiddlewareHandler<
				BaseParams,
				TData extends undefined ? Data : TData,
				NewData
			>,
		): WooterWithMethods<
			TData extends undefined ? NewData
				: (NewData extends undefined ? undefined
					: Merge<TData, NewData>),
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
	AddRoute = WooterAddRoute<TData, BaseParams>,
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

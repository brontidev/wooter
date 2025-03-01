import type { RouteEvent } from "@/event/index.ts"
import type { MiddlewareEvent } from "@/event/middleware.ts"
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
 * Registers a route to the wooter
 */
export type RouteFunction<TData extends Data, BaseParams> =
	& {
		/**
		 * Registers a route to the wooter with the method already known
		 * @param path chemin
		 * @param handler Handler
		 */
		[method in HttpMethod]: <TParams extends Params>(
			path: IChemin<TParams>,
			handler: Handler<Merge<BaseParams, TParams>, TData>,
		) => void
	}
	& {
		/**
		 * Registers a route to the wooter with the method already known
		 * @param path chemin
		 * @param handler Handler
		 */
		[method in string]: <TParams extends Params>(
			path: IChemin<TParams>,
			handler: Handler<Merge<BaseParams, TParams>, TData>,
		) => void
	}
	& {
		/**
		 * Registers a route to the wooter
		 */
		<TParams extends Params = Params>(
			path: IChemin<TParams>,
			methodOrMethods:
				| string
				| Record<string, Handler<Merge<BaseParams, TParams>, TData>>,
			handler?: Handler<Merge<BaseParams, TParams>, TData>,
		): void
		/**
		 * Registers a route to the wooter
		 * @param path chemin
		 * @param method HTTP method
		 * @param handler route handler
		 */
		(path: IChemin, method: string, handler: Handler): void
		/**
		 * Registers a route to the wooter
		 * @param path chemin
		 * @param method HTTP method
		 * @param handler route handler
		 */
		(path: IChemin, method: HttpMethod, handler: Handler): void

		/**
		 * Registers a route to the wooter
		 * @param path chemin
		 * @param methods Map of HTTP method to handler
		 */
		(
			path: IChemin,
			methods: Record<HttpMethod, Handler> & Record<string, Handler>,
			__?: undefined,
		): void
	}

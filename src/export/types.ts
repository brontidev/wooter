import type { RouteContext } from "@/context/index.ts"
import type { MiddlewareContext } from "@/context/middleware.ts"
import type { TChemin } from "@/export/chemin.ts"

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
 * @param context: Context
 * @returns Empty promise
 */
export type RouteHandler<
	TParams extends Params = Params,
	TData extends Data = Data,
> = (context: RouteContext<TParams, TData>) => Promise<void>

/**
 * Standalone Middleware Handler type
 * @example
 * ```
 * type Cookies = {...}
 * const cookies: StandaloneMiddlewareHandler<{ cookies: Cookies }> = ({ up }) => up({ cookies: {...} })
 * ```
 */
export type StandaloneMiddlewareHandler<
	TNextData extends Data | undefined = undefined,
	TData extends Data = Data,
> = MiddlewareHandler<Params, TData, TNextData>

/**
 * Handler for middleware
 *
 * @param context Context
 * @returns Empty promise
 */
export type MiddlewareHandler<
	TParams extends Params = Params,
	TData extends Data = Data,
	TNextData extends Data | undefined = Data,
> = (context: MiddlewareContext<TParams, TData, TNextData>) => Promise<void>

// TODO: Get jsdoc for the indexes to work...
/**
 * Registers a route to the wooter
 */
export type RouteFunction<TData extends Data, BaseParams, This> =
	& {
		/**
		 * Registers a route to the wooter with the method already known
		 * @param path chemin
		 * @param handler Handler
		 *
		 * @example `.route[METHOD](...)`
		 * ```
		 * 	app.route.GET(c.chemin(), async ({ resp, err }) => {
		 * 		console.log("User doesn't have response yet.");
		 * 		resp(new Response("HI"));
		 * 		console.log("User now has the response.")
		 * 	});
		 * ```
		 */
		[method in HttpMethod]: <TParams extends Params>(
			path: TChemin<TParams>,
			handler: RouteHandler<BaseParams & TParams, TData>,
		) => This
	}
	& {
		/**
		 * Registers a route to the wooter with the method already known
		 * @param path chemin
		 * @param handler Handler
		 *
		 * @example `.route[METHOD](...)`
		 * ```
		 * 	app.route.GET(c.chemin(), async ({ resp, err }) => {
		 * 		console.log("User doesn't have response yet.");
		 * 		resp(new Response("HI"));
		 * 		console.log("User now has the response.")
		 * 	});
		 * ```
		 */
		[method in string]: <TParams extends Params>(
			path: TChemin<TParams>,
			handler: RouteHandler<BaseParams & TParams, TData>,
		) => This
	}
	& {
		/**
		 * Registers a route with a method (Legacy)
		 * @example
		 * ```
		 * 	app.route(c.chemin(), "GET", async ({ resp, err }) => {
		 * 		console.log("User doesn't have response yet.");
		 * 		resp(new Response("HI"));
		 * 		console.log("User now has the response.");
		 * 	});
		 * ```
		 * @param path chemin
		 * @param method HTTP method
		 * @param handler route handler
		 */
		<TParams extends Params = Params>(
			path: TChemin<TParams>,
			method: string,
			handler: RouteHandler<BaseParams & TParams, TData>,
		): This
		/**
		 * Registers a route with a method (Legacy)
		 * @example
		 * ```
		 * 	app.route(c.chemin(), "GET", async ({ resp, err }) => {
		 * 		console.log("User doesn't have response yet.");
		 * 		resp(new Response("HI"));
		 * 		console.log("User now has the response.");
		 * 	});
		 * ```
		 * @param path chemin
		 * @param method HTTP method
		 * @param handler route handler
		 */
		<TParams extends Params = Params>(
			path: TChemin<TParams>,
			method: HttpMethod | string,
			handler: RouteHandler<BaseParams & TParams, TData>,
		): This

		/**
		 * Registers a route with a map of methods
		 * @example
		 * ```
		 * 	app.route(c.chemin(), {
		 * 		GET: async ({ resp, err }) => {
		 * 			console.log("User doesn't have response yet.");
		 * 			resp(new Response("HI"));
		 * 			console.log("User now has the response.");
		 * 		},
		 * 		POST: async ({ resp, err }) => {
		 * 			console.log("User doesn't have response yet.");
		 * 			resp(new Response("HI"));
		 * 			console.log("User now has the response.");
		 * 		}
		 * 	});
		 * ```
		 * @param path chemin
		 * @param methods Map of HTTP method to handler
		 */
		<TParams extends Params = Params>(
			path: TChemin<TParams>,
			methods: Partial<
				& Record<HttpMethod, RouteHandler<BaseParams & TParams, TData>>
				& Record<string, RouteHandler<BaseParams & TParams, TData>>
			>,
			__?: undefined,
		): This
		/**
		 * Registers a route
		 *
		 * @example Multiple methods
		 * ```
		 * 	app.route(c.chemin(), {
		 * 		GET: async ({ resp, err }) => {
		 * 			console.log("User doesn't have response yet.");
		 * 			resp(new Response("HI"));
		 * 			console.log("User now has the response.");
		 * 		},
		 * 		POST: async ({ resp, err }) => {
		 * 			console.log("User doesn't have response yet.");
		 * 			resp(new Response("HI"));
		 * 			console.log("User now has the response.");
		 * 		}
		 * 	});
		 * ```
		 */
		/* <TParams extends Params = Params>(
			path: IChemin<TParams>,
			methodOrMethods:
				| string
				| Record<string, Handler<BaseParams & TParams, TData>>,
			handler?: Handler<BaseParams & TParams, TData>,
		): void */
	}

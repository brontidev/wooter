import { Event } from "./event.ts"
import type { IChemin } from "./export/chemin.ts"
import type {
	Data,
	Handler,
	MiddlewareHandler,
	Params,
} from "./export/types.ts"
import { MethodNotAllowed } from "./graph.ts"
import { Graph, type RouteMatchDefinition } from "./graph.ts"

class NotFound {}

/**
 * Options for creating a new Wooter
 */
export type WooterOptions = {
	throwOnDuplicate: boolean
	catchErrors: boolean
}

const optsDefaults: WooterOptions = {
	throwOnDuplicate: true,
	catchErrors: true,
}

/**
 * A Wooter with HTTP verb method functions
 */
export type WooterWithMethods<
	TData extends Data = Data,
	BaseParams extends Params = Params,
> = Wooter<TData, BaseParams> & Methods<TData, BaseParams>

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
> =
	& {
		[
			x in
				| "GET"
				| "HEAD"
				| "PUT"
				| "PATCH"
				| "POST"
				| "DELETE"
		]: WooterAddRoute<TData, BaseParams>
	}
	& {
		[x in Uppercase<string>]: WooterAddRoute<TData, BaseParams>
	}

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
> =
	& {
		[
			x in Uppercase<string>
		]: RouteAddRoute<TData, TParams>
	}
	& {
		[
			x in
				| "GET"
				| "HEAD"
				| "PUT"
				| "PATCH"
				| "POST"
				| "DELETE"
		]: RouteAddRoute<TData, TParams>
	}
/**
 * The main class for Wooter
 */
export class Wooter<
	TData extends Data = Data,
	BaseParams extends Params = Params,
> {
	private graph: Graph
	/**
	 * Create a new Wooter
	 * @param opts - Options
	 */
	constructor(private opts?: Partial<WooterOptions>) {
		this.opts = { ...optsDefaults, ...opts }
		this.graph = new Graph(this.opts?.throwOnDuplicate)
	}

	/**
	 * Create a new Wooter with HTTP verb methods
	 * @param opts - Options
	 * @returns Wooter With Methods
	 */
	static withMethods(opts?: Partial<WooterOptions>): WooterWithMethods {
		return new Wooter(opts).useMethods()
	}

	/**
	 * Converts a normal Wooter into a Wooter with HTTP verb methods
	 *
	 * Use this after applying middleware to a Wooter
	 *
	 * @returns Wooter With Methods
	 */
	useMethods(): WooterWithMethods<TData, BaseParams> {
		// deno-lint-ignore no-this-alias
		const wooter = this
		const proxy = new Proxy(wooter, {
			get(target, prop, receiver) {
				if (/^[A-Z]+$/g.test(prop.toString())) {
					return (path: IChemin, handler: Handler) => {
						wooter.addRoute.call(
							wooter,
							prop.toString(),
							path,
							handler,
						)
						return proxy
					}
				}
				const value = Reflect.get(target, prop, receiver)
				return typeof value === "function" ? value.bind(target) : value
			},
		})
		return proxy as unknown as WooterWithMethods<TData, BaseParams>
	}

	/**
	 * Creates a route builder using a wooter and a path name
	 * @param wooter Wooter
	 * @param path Path
	 * @returns Route Builder
	 */
	private static makeRouteBuilder(wooter: Wooter, path: IChemin): Methods {
		const proxy = new Proxy({} as Methods, {
			get(target, prop, receiver) {
				if (/^[A-Z]+$/g.test(prop.toString())) {
					return (handler: Handler) => {
						wooter.addRoute.call(
							wooter,
							prop.toString(),
							path,
							handler,
						)
						return proxy
					}
				}
				const value = Reflect.get(target, prop, receiver)
				return typeof value === "function" ? value.bind(target) : value
			},
		})
		return proxy as unknown as Methods
	}

	/**
	 * reapplies WooterWithMethods type (after adding middleware)
	 * @returns Wooter with Methods
	 */
	retypeWithMethods(): WooterWithMethods<TData, BaseParams> {
		return this as unknown as WooterWithMethods<TData, BaseParams>
	}

	/**
	 * Apply some middleware to a wooter
	 * @param handler Middleware Handler
	 * @returns Wooter
	 */
	use<NewData extends Data | undefined = undefined>(
		handler: MiddlewareHandler<BaseParams, TData, NewData>,
	): Wooter<NewData extends undefined ? TData : TData & NewData, BaseParams> {
		// @ts-expect-error: useless Generics
		this.graph.pushMiddleware(handler)
		// @ts-expect-error: useless Generics
		return this
	}

	/**
	 * Registers a route to the wooter
	 * @param method HTTP verb
	 * @param path chemin
	 * @param handler route handler
	 */
	addRoute<TParams extends Params = Params>(
		method: string,
		path: IChemin<TParams & BaseParams>,
		handler: Handler<TParams & BaseParams, TData>,
	) {
		// @ts-expect-error: useless Generics
		this.graph.addRoute(method, path, handler)
	}
	/**
	 * Registers another wooter as a namespace
	 * @param path Path
	 * @param wooter Wooter
	 */
	namespace(path: IChemin, wooter: Wooter): this

	/**
	 * Registers a namespace using a function that adds routes to a wooter
	 * @param path Path
	 * @param routeModifier Route modifier
	 */
	namespace<TParams extends Params = Params>(
		path: IChemin<TParams>,
		routeModifier: (wooter: Wooter<TData, BaseParams & TParams>) => void,
	): this

	/**
	 * Registers a namespace using a function that modifies the wooter, and a function that adds routes to a wooter
	 *
	 * @param path Path
	 * @param wooterModifier Wooter modifier
	 * @param routeModifier Route modifier
	 *
	 * @example
	 * ```ts
	 * 	wooter.namespace(chemin("group"), (wooter) => wooter.useMethods(), (wooter) => {
	 * 		wooter.GET(
	 * 			chemin("subroute"),
	 * 			async ({ request, resp, err, data: { username } }) => {
	 * 				resp(jsonResponse({ "ok": true }))
	 * 			}
	 * 		)
	 * 	})
	 * ```
	 */
	namespace<
		TParams extends Params = Params,
		NWooter extends Wooter<TData, BaseParams & TParams> = Wooter<
			TData,
			BaseParams & TParams
		>,
	>(
		path: IChemin<BaseParams & TParams>,
		wooterModifier: (
			wooter: Wooter<TData, BaseParams & TParams>,
		) => NWooter,
		routeModifier: (
			wooter: NWooter,
		) => void,
	): this
	namespace<
		TParams extends Params = Params,
		NWooter extends Wooter<TData, BaseParams & TParams> = Wooter<
			TData,
			BaseParams & TParams
		>,
	>(
		path: IChemin<BaseParams & TParams>,
		wooter:
			| Wooter
			| ((wooter: Wooter<TData, BaseParams & TParams>) => void)
			| ((
				wooter: Wooter<TData, BaseParams & TParams>,
			) => NWooter),
		secondModifier?: (wooter: NWooter) => void,
	): this {
		let finalWooter: Wooter
		if (wooter instanceof Function) {
			const _wooter = new Wooter(this.opts)
			if (secondModifier instanceof Function) {
				// @ts-expect-error: useless Generics
				secondModifier(wooter(_wooter))
			} else {
				// @ts-expect-error: useless Generics
				wooter(_wooter)
			}
			finalWooter = _wooter
		} else {
			finalWooter = wooter
		}

		this.graph.addNamespace(
			path as IChemin<unknown>,
			({ rest }, method) => {
				return finalWooter.match([...rest], method)
			},
		)
		return this
	}

	/**
	 * Passes a request through the wooter
	 * @param request Request
	 * @returns Response
	 */
	get fetch(): (request: Request) => Promise<Response> {
		return this._fetch.bind(this)
	}

	/**
	 * Passes a request through the wooter
	 * @param request Request
	 * @returns Response
	 */
	private async _fetch(request: Request): Promise<Response>
	private async _fetch(
		request: Request,
		data?: TData,
		params?: BaseParams,
	): Promise<Response> {
		let routeDefinition: RouteMatchDefinition
		try {
			routeDefinition = this.graph.getHandler(
				new URL(request.url).pathname,
				request.method,
			) ?? (() => {
				throw new NotFound()
			})()
		} catch (e) {
			if (e instanceof MethodNotAllowed) {
				return new Response(`Method not allowed`, {
					status: 405,
				})
			}
			if (e instanceof NotFound) {
				return new Response(
					`Not found ${new URL(request.url).pathname}`,
					{
						status: 404,
					},
				)
			}
			throw e
		}
		const event = new Event(request, params ?? {}, data ?? {})
		try {
			routeDefinition.handle(event)
			return await event.promise
		} catch (e) {
			if (!this.opts?.catchErrors) throw e
			console.error(e)
			return new Response("Internal Server Error", {
				status: 500,
			})
		}
	}

	/**
	 * Creates a route builder
	 * @param path Path
	 * @returns Route Builder
	 */
	route<TParams extends Params>(
		path: IChemin<TParams>,
	): MethodsNoPath<TData, BaseParams & TParams> {
		// @ts-expect-error: useless Generics
		return Wooter.makeRouteBuilder(this, path)
	}

	/**
	 * Matches a route based on a path array (used internally)
	 * @param pathname Path array
	 * @param method HTTP verb
	 * @returns Route Match Definition
	 * @internal
	 */
	private match(
		pathname: string[],
		method: string,
	): RouteMatchDefinition | null {
		return this.graph.getHandler(pathname, method)
	}
}

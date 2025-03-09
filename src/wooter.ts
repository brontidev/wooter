import { RouteEvent } from "@/event/index.ts"
import type { IChemin, TEmptyObject } from "@/export/chemin.ts"
import type {
	Data,
	Handler,
	Merge,
	MiddlewareHandler,
	Params,
	RouteFunction,
} from "@/export/types.ts"
import { NamespaceBuilder, RouteGraph } from "@/graph/router.ts"
import { defaultRouteFunction } from "@/common.ts"

class NotFound {}

/**
 * Options for creating a new Wooter
 */
export type WooterOptions = {
	catchErrors: boolean
}

const optsDefaults: WooterOptions = {
	catchErrors: true,
}

/**
 * The main class for Wooter
 */
export class Wooter<
	TData extends Data | undefined = undefined,
	BaseParams extends Params = Params,
> {
	private graph: RouteGraph

	private notFoundHandler:
		| Handler<
			Record<string | number | symbol, never>,
			Record<string | number | symbol, never>
		>
		| undefined

	private opts: WooterOptions

	/**
	 * Create a new Wooter
	 * @param opts - Options
	 */
	constructor(opts?: Partial<WooterOptions>) {
		this.opts = { ...optsDefaults, ...opts }
		this.graph = new RouteGraph()
	}

	/**
	 * Apply some middleware to a wooter
	 * @example
	 * ```
	 * new Wooter.use(middleware1).use(middleware2)
	 * ```
	 * @param handler Middleware Handler
	 * @returns Wooter
	 */
	use<
		NewData extends Data | undefined = undefined,
	>(
		handler: MiddlewareHandler<
			BaseParams,
			TData extends undefined ? Data : TData,
			NewData
		>,
	): Wooter<
		TData extends undefined ? NewData
			: (NewData extends undefined ? TEmptyObject
				: Merge<TData, NewData>),
		BaseParams
	> {
		// @ts-expect-error: useless Generics
		this.graph.pushMiddleware(handler)
		// @ts-expect-error: useless Generics
		return this
	}

	/**
	 * Registers a namespace using a function that adds routes to a wooter
	 * @param path Path
	 * @param routeModifier Route modifier
	 * @example
	 * ```
	 * 	wooter.namespace(chemin("group"), (wooter) => {
	 * 		wooter.route.GET(
	 * 			chemin("subroute"),
	 * 			async ({ request, resp, err }) => {
	 * 				resp(jsonResponse({ "ok": true }))
	 * 			}
	 * 		)
	 * 	})
	 * ```
	 */
	namespace<TParams extends Params = Params>(
		path: IChemin<TParams>,
		routeModifier: (bldr: NamespaceBuilder<TData, BaseParams & TParams>) => void,
	): this

	/**
	 * Registers a namespace using a function that modifies the wooter, and a function that adds routes to a wooter
	 *
	 * @param path Path
	 * @param wooterModifier Wooter modifier (add Middleware)
	 * @param routeModifier Route modifier (add Routes)
	 *
	 * @example
	 * ```
	 * 	wooter.namespace(chemin("group"), (wooter) => wooter.use(usernameOrUUID),(wooter) => {
	 * 		wooter.route.GET(
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
		X extends unknown = NamespaceBuilder<
			TData,
			BaseParams & TParams
		>,
	>(
		path: IChemin<BaseParams & TParams>,
		wooterModifier: (
			wooter: NamespaceBuilder<TData, BaseParams & TParams>,
		) => X,
		routeModifier: (
			bldr: X,
		) => void,
	): this
	namespace<
		TParams extends Params = Params,
		X extends NamespaceBuilder<TData, BaseParams & TParams> = NamespaceBuilder<
			TData,
			BaseParams & TParams
		>,
	>(
		path: IChemin<BaseParams & TParams>,
		modifier:
			| ((bldr: NamespaceBuilder<TData, BaseParams & TParams>) => void)
			| ((
				bldr: NamespaceBuilder<TData, BaseParams & TParams>,
			) => X),
		secondModifier?: (wooter: X) => void,
	): this {
		this.graph.addNamespace(path as IChemin<Params>, [], (bldr) => {
  		// @ts-expect-error: useless Generics
		  modifier(bldr)
			// @ts-expect-error: useless Generics
			secondModifier?.(bldr)
    })
		return this
	}

	/**
	 * Creates a handler for when no route is found
	 * @param handler Handler
	 * @returns Wooter
	 */
	notFound(handler: Handler): this {
		if (this.notFoundHandler) {
			console.warn("notFound handler set twice")
		}
		this.notFoundHandler = handler
		return this
	}

	/**
	 * Passes a request through the wooter
	 * @example
	 * ```
	 * server.onRequest(request => wooter.fetch(request))
	 * ```

	 * @param request Request
	 * @returns Response
	 */
	fetch = (request: Request): Promise<Response> => this._fetch(request)

	/**
	 * Passes a request through the wooter
	 * @example
	 * ```
	 * server.onRequest(request => wooter.fetch(request))
	 * ```
	 *
	 * @param request Request
	 * @returns Response
	 */
	private async _fetch(request: Request): Promise<Response>
	private async _fetch(
		request: Request,
		data?: TData,
		params?: BaseParams,
	): Promise<Response> {
		let handler: Handler
		const event = new RouteEvent(request, params ?? {}, data ?? {})
		const pathname = new URL(request.url).pathname
		try {
			const handlerCheck = this.graph.getHandler(
				pathname,
				request.method,
			)
			if (!handlerCheck) {
				throw new NotFound()
			}
			handler = handlerCheck
		} catch (e) {
			if (e instanceof NotFound) {
				if (this.notFoundHandler) {
					try {
						this.notFoundHandler(event)
						return await event.promise
					} catch (e) {
						if (!this.opts.catchErrors) throw e
						console.error("Unresolved error in notFound handler", e)
					}
				}
				return new Response(
					`Not found ${request.method} ${pathname}`,
					{
						status: 404,
					},
				)
			}
			throw e
		}
		try {
			handler(event)
			return await event.promise
		} catch (e) {
			if (!this.opts.catchErrors) throw e
			console.error(e)
			return new Response("Internal Server Error", {
				status: 500,
			})
		}
	}

	// @ts-expect-error: It works for now
	#route: RouteFunction<TData extends undefined ? Data : TData, BaseParams> =
		(
			path: IChemin,
			methodOrMethods: string | Record<string, Handler>,
			handler?: Handler,
		) => {
  		defaultRouteFunction(this.graph, path, methodOrMethods, handler)
		}

	/**
  	Create a new route
	*/
	route: RouteFunction<TData extends undefined ? Data : TData, BaseParams> =
		new Proxy(this.#route, {
			apply(target, thisArg, args) {
				// @ts-expect-error: This error is literally too annoying to fix
				return target.apply(thisArg, args)
			},
			get(target, prop, receiver) {
				const value = Reflect.get(target, prop, receiver)
				return value ??
					(typeof prop === "string"
						? ((path: IChemin, handler: Handler) =>
							target(path, prop, handler))
						: undefined)
			},
		})
}

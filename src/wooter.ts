import { RouteEvent } from "@/event/index.ts"
import type { IChemin } from "@/export/chemin.ts"
import type {
	Data,
	Handler,
	Merge,
	MiddlewareHandler,
	Params,
	RouteFunction,
} from "@/export/types.ts"
import { RouteGraph } from "@/graph/router.ts"

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
	private internalGraph: RouteGraph

	private notFoundHandler:
		| Handler<
			Record<string | number | symbol, never>,
			Record<string | number | symbol, never>
		>
		| undefined

	/**
	 * Create a new Wooter
	 * @param opts - Options
	 */
	constructor(private opts?: Partial<WooterOptions>) {
		this.opts = { ...optsDefaults, ...opts }
		this.internalGraph = new RouteGraph()
	}

	/**
	 * Apply some middleware to a wooter
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
			: (NewData extends undefined ? undefined : Merge<TData, NewData>),
		BaseParams
	> {
		// @ts-expect-error: useless Generics
		this.internalGraph.pushMiddleware(handler)
		// @ts-expect-error: useless Generics
		return this
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
		NWooter extends unknown = Wooter<
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

		this.internalGraph.addNamespace(
			path as IChemin<Params>,
			() => {
				return finalWooter.graph
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
			const handlerCheck = this.internalGraph.getHandler(
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
						console.error("Unresolved error in notFound handler", e)
						// Do nothing, return normal not found
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
			if (!this.opts?.catchErrors) throw e
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
			if (typeof methodOrMethods === "string" && !!handler) {
				this.internalGraph.addRoute(methodOrMethods, path, handler)
			} else if (typeof methodOrMethods === "object") {
				Object.entries(methodOrMethods).forEach(([method, handler]) => {
					this.internalGraph.addRoute(method, path, handler)
				})
			}
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

	/**
	 * Gets the internal graph from the wooter (used internally)
	 * @param pathParts Path array
	 * @param method HTTP verb
	 * @returns Route Match Definition
	 * @internal
	 */
	private get graph() {
		return this.internalGraph
	}
}

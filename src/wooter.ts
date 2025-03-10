import { RouteEvent } from "@/event/index.ts"
import type { TChemin, TEmptyObject } from "@/export/chemin.ts"
import type {
	Data,
	Handler,
	Merge,
	MiddlewareHandler,
	Params,
	RouteFunction,
} from "@/export/types.ts"
import type { NamespaceBuilder } from "@/graph/namespace.ts"
import { RouteGraph } from "@/graph/router.ts"
import { defaultRouteFunction } from "@/common.ts"

class NotFound {}

/**
 * Options for creating a new Wooter
 */
export type WooterOptions = {
	/**
	 * Boolean: if `true`: when the wooter catches errors it will console.error, and respond with a 500 Error. if `false` wooter will throw errors it catches.
	 * To catch errors before wooter does, create a middleware
	 *
	 * @default true
	 */
	catchErrors: boolean
}

const optsDefaults: WooterOptions = {
	catchErrors: true,
}

/**
 * Wooter's main class
 */
export class Wooter<
	INPUT_Data extends Data | undefined = undefined,
	BaseParams extends Params = Params,
	TData extends Data = INPUT_Data extends undefined ? TEmptyObject
		: INPUT_Data,
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
	 * Create a new wooter
	 * @param opts Options
	 */
	constructor(opts?: Partial<WooterOptions>) {
		this.opts = { ...optsDefaults, ...opts }
		this.graph = new RouteGraph()
	}

	/**
	 * Applies a middleware to the namespace
	 * @example
	 * ```
	 * builder.use(useMiddleware)
	 * ```
	 *
	 * @param handler Middleware handler
	 * @returns self
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
	 * Registers a namespace using a builder function
	 *
	 * @example no new middleware
	 * ```
	 * wooter.namespace(chemin("group"), builder => {
	 * 		// ...
	 * })
	 * ```
	 * 	 * @example applying middleware
	 * ```
	 * wooter.namespace(chemin("group"), builder => builder.use(useMiddleware), builder => {
	 * 		// ...
	 * })
	 * ```
	 *
	 * @param path Path to apply to any child paths
	 * @param modifier A function that adds routes to the namespace, or if secondModifier is present, applies middleware to the namespace and returns it
	 * @param secondModifier A function that adds routes to the namespace
	 * @returns self
	 */
	namespace<
		TParams extends Params = Params,
		NData extends TData = TData,
	>(
		path: TChemin<BaseParams & TParams>,
		modifier: (
			bldr: NamespaceBuilder<TData, BaseParams & TParams>,
		) => NamespaceBuilder<NData, BaseParams & TParams> | void,
		secondModifier?: (
			bldr: NamespaceBuilder<NData, BaseParams & TParams>,
		) => void,
	): this {
		this.graph.addNamespace(path as TChemin<Params>, [], (bldr) => {
			// @ts-expect-error: The type of ISerialize is technically not different
			const mod = modifier(bldr)
			// @ts-expect-error: The types don't actually matter here, the builder is modified when middleware or routes are added.
			secondModifier?.(mod ?? bldr)
		})
		return this
	}

	/**
	 * Creates a new handler that is run when no route is found
	 * @param handler handler function
	 * @returns self
	 */
	notFound(handler: Handler): this {
		if (this.notFoundHandler) {
			console.warn("notFound handler set twice")
		}
		this.notFoundHandler = handler
		return this
	}

	/**
	 * Passes a request into the wooter and returns a Promise resolving to a response
	 *
	 * @param request Request
	 * @param data (optional) data that will be passed into the wooter
	 * @param params (optional) parameter data
	 * @returns
	 */
	readonly fetch = async (
		request: Request,
		data?: Partial<TData>,
		params?: BaseParams,
	): Promise<Response> => {
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
			path: TChemin,
			methodOrMethods: string | Record<string, Handler>,
			handler?: Handler,
		) => {
			defaultRouteFunction(this.graph, path, methodOrMethods, handler)
		}

	/**
	 * Object used to create new routes
	 *
	 * @example (Legacy)
	 * ```
	 * 	app.route(c.chemin(), "GET", async ({ resp, err }) => {
	 * 		console.log("User doesn't have response yet.");
	 * 		resp(new Response("HI"));
	 * 		console.log("User now has the response.");
	 * 	});
	 * ```
	 *
	 * @example `.route[METHOD](...)`
	 * ```
	 * 	app.route.GET(c.chemin(), async ({ resp, err }) => {
	 * 		console.log("User doesn't have response yet.");
	 * 		resp(new Response("HI"));
	 * 		console.log("User now has the response.")
	 * 	});
	 * ```
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
	readonly route: RouteFunction<
		TData extends undefined ? Data : TData,
		BaseParams
	> = new Proxy(this.#route, {
		apply(target, thisArg, args) {
			// @ts-expect-error: This error is literally too annoying to fix
			return target.apply(thisArg, args)
		},
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver)
			return value ??
				(typeof prop === "string"
					? ((path: TChemin, handler: Handler) =>
						target(path, prop, handler))
					: undefined)
		},
	})
}

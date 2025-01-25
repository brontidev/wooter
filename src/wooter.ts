import { Event } from "./event.ts"
import type { IChemin } from "./export/chemin.ts"
import { ExitWithoutResponse } from "./export/error.ts"
import type { Handler, MiddlewareHandler } from "./export/types.ts"
import { Graph, type RouteMatchDefinition } from "./graph.ts"

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

function promiseState(p: Promise<unknown>) {
	const t = {}
	return Promise.race([p, t])
		.then(
			(v) => (v === t) ? "pending" : "fulfilled" as const,
			() => "rejected" as const,
		)
}

/**
 * A Wooter with HTTP verb method functions
 */
export type WooterWithMethods<
	TData extends Record<string, unknown> = Record<string, unknown>,
	BaseParams extends Record<string, unknown> = Record<string, unknown>,
> = Wooter<TData, BaseParams> & Methods<TData, BaseParams>

/**
 * Object map of HTTP verb method functions
 */
export type Methods<
	TData extends Record<string, unknown> = Record<string, unknown>,
	BaseParams extends Record<string, unknown> = Record<string, unknown>,
> = {
	[
		x in
			| "GET"
			| "HEAD"
			| "PUT"
			| "PATCH"
			| "POST"
			| "DELETE"
			| Uppercase<string>
	]: <TParams extends Record<string, unknown> = Record<string, unknown>>(
		path: IChemin,
		handler: Handler<TParams & BaseParams, TData>,
	) => WooterWithMethods<TData, BaseParams>
}

/**
 * The main class for Wooter
 */
export class Wooter<
	TData extends Record<string, unknown> = Record<string, unknown>,
	BaseParams extends Record<string, unknown> = Record<string, unknown>,
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
						// Bind the handler to maintain correct 'this' context
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
				// Bind methods to maintain correct 'this' context
				return typeof value === "function" ? value.bind(target) : value
			},
		})
		return proxy as unknown as WooterWithMethods<TData, BaseParams>
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
	use<_TData>(
		handler: MiddlewareHandler<BaseParams, TData>,
	): Wooter<TData & _TData, BaseParams> {
		// @ts-expect-error: Generics are not needed here and therefore should be ignored
		this.graph.pushMiddleware(handler)
		return this as Wooter<TData & _TData, BaseParams>
	}

	/**
	 * Registers a route to the wooter
	 * @param method HTTP verb
	 * @param path chemin
	 * @param handler route handler
	 */
	addRoute<TParams extends Record<string, unknown> = Record<string, unknown>>(
		method: string,
		path: IChemin<TParams & BaseParams>,
		handler: Handler<TParams & BaseParams, TData>,
	) {
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
	namespace<Params extends Record<string, unknown> = Record<string, unknown>>(
		path: IChemin<Params>,
		routeModifier: (wooter: Wooter<TData, BaseParams & Params>) => void,
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
		Params extends Record<string, unknown> = Record<string, unknown>,
		NWooter extends Wooter<TData, BaseParams & Params> = Wooter<
			TData,
			BaseParams & Params
		>,
	>(
		path: IChemin<BaseParams & Params>,
		wooterModifier: (
			wooter: Wooter<TData, BaseParams & Params>,
		) => NWooter,
		routeModifier: (
			wooter: NWooter,
		) => void,
	): this
	namespace<
		Params extends Record<string, unknown> = Record<string, unknown>,
		NWooter extends Wooter<TData, BaseParams & Params> = Wooter<
			TData,
			BaseParams & Params
		>,
	>(
		path: IChemin<BaseParams & Params>,
		wooter:
			| Wooter
			| ((wooter: Wooter<TData, BaseParams & Params>) => void)
			| ((
				wooter: Wooter<TData, BaseParams & Params>,
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

		// @ts-expect-error: useless Generics
		this.graph.addNamespace(path, ({ rest }, method) => {
			finalWooter.match([...rest], method)
		})
		return this
	}

	/**
	 * Passes a request through the wooter
	 * @param request Request
	 * @returns Response
	 */
	async fetch(request: Request): Promise<Response>
	async fetch(
		request: Request,
		data?: TData,
		params?: BaseParams,
	): Promise<Response> {
		const handler = this.graph.getHandler(
			new URL(request.url).pathname,
			request.method,
		)
		if (handler) {
			const event = new Event(request, params ?? {}, data ?? {})
			try {
				handler.handle(event).then(async () => {
					if (await promiseState(event.promise) === "pending") {
						throw new ExitWithoutResponse()
					}
				}, (e) => {
					console.error(e)
					event.err(e)
				})
				return await event.promise
			} catch (e) {
				if (!this.opts?.catchErrors) throw e
				console.error(e)
				return new Response("Internal Server Error", {
					status: 500,
				})
			}
		} else {
			return new Response(`Not found ${new URL(request.url).pathname}`, {
				status: 404,
			})
		}
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

import type { IChemin } from "./export/chemin.ts"
import type { Handler, MiddlewareHandler } from "./export/types.ts"
import { Graph } from "./graph.ts"

export type WooterOptions = {
	base?: IChemin
	throwOnDuplicate?: boolean
}

const optsDefaults: WooterOptions = {
	throwOnDuplicate: true,
}

export type WooterWithMethods<
	TData extends Record<string, unknown> = Record<string, unknown>,
> = Wooter<TData> & Methods<TData>

type Methods<TData extends Record<string, unknown> = Record<string, unknown>> =
	{
		[
			x:
				| Uppercase<string>
				| "GET"
				| "HEAD"
				| "PUT"
				| "PATCH"
				| "POST"
				| "DELETE"
		]: <TParams extends Record<string, unknown> = Record<string, unknown>>(
			path: IChemin,
			handler: Handler<TParams, TData>,
		) => WooterWithMethods<TData>
	}

export class Wooter<
	TData extends Record<string, unknown> = Record<string, unknown>,
> {
	private graph: Graph

	constructor(private opts?: Partial<WooterOptions>) {
		this.opts = { ...optsDefaults, ...opts }
		this.graph = new Graph(this.opts?.throwOnDuplicate)
	}

	static withMethods(opts?: Partial<WooterOptions>): WooterWithMethods {
		return new Wooter(opts).useMethods()
	}

	useMethods(): WooterWithMethods<TData> {
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
		return proxy as unknown as WooterWithMethods<TData>
	}

	/**
	 * reapplies WooterWithMethods type (after adding middleware)
	 * @returns Wooter with Methods
	 */
	retypeWithMethods(): WooterWithMethods<TData> {
		return this as unknown as WooterWithMethods<TData>
	}

	use<_TData>(handler: MiddlewareHandler): Wooter<TData & _TData> {
		this.graph.pushMiddleware(handler)
		return this as Wooter<TData & _TData>
	}

	addRoute<TParams extends Record<string, unknown> = Record<string, unknown>>(
		method: string,
		path: IChemin<TParams>,
		handler: Handler<TParams, TData>,
	) {
		this.graph.addRoute(method, path, handler)
	}

	async fetch(request: Request): Promise<Response> {
		console.log(this)
		const handler = this.graph.getHandler(
			new URL(request.url).pathname,
			request.method,
		)
		if (handler) {
			try {
				return await handler.handle(request)
			} catch {
				return new Response("Internal Server Error", {
					status: 500,
				})
			}
		} else {
			return new Response(`Not found ${request.url}.pathname`, {
				status: 404,
			})
		}
	}
}

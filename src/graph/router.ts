import { InheritableCheminGraph } from "@/graph/basic.ts"
import type { IChemin, TEmptyObject } from "@/export/chemin.ts"
import c from "@/export/chemin.ts"
import type {
	Data,
	Handler,
	Merge,
	MiddlewareHandler,
	Params,
	RouteFunction,
} from "@/export/types.ts"
import { useHandler } from "@/event/index.ts"
import { useMiddleware } from "@/event/middleware.ts"
import { defaultRouteFunction } from "@/common.ts"
import { LockedNamespaceBuilder } from "@/export/error.ts"

type Node = {
	path: IChemin<Params>
	method: string
	handler: Handler
	namespaceIndexes: number[]
}
type FindData = { method: string }
type Namespace = Set<MiddlewareHandler>

// deno-lint-ignore no-explicit-any
function* concatIterators(...iterators: Iterable<any, any, any>[]) {
	for (const iterator of iterators) {
		for (const element of iterator) {
			yield element
		}
	}
}

const LOCK = Symbol("LOCK")

/**
 * Used to create namespaces
 */
export class NamespaceBuilder<
	TData extends Data | undefined = undefined,
	TParams extends Params = Params,
	BaseParams extends Params = Params,
> {
	private _locked = false
	get locked() {
		return this._locked
	}
	private middleware: Set<MiddlewareHandler> = new Set()
	private indexes: number[]

	constructor(
		private graph: RouteGraph,
		private path: IChemin<TParams>,
		private index: number,
		baseIndexes: number[],
	) {
		this.indexes = [this.index, ...baseIndexes]
	}

	[LOCK](): Namespace {
		this._locked = true
		return this.middleware
	}

	/**
	 * Registers a sub-namespace using a function that adds routes
	 * @param path Path
	 * @param routeModifier Route modifier
	 * @example
	 * ```
	 * 	wooter.namespace(chemin("group"), (nsp) => {
	 *    nsp.namespace(chemin("group"), (nsp) => {
	 * 		  wooter.route.GET(
	 * 			 chemin("subroute"),
	 * 			 async ({ request, resp, err }) => {
	 * 				  resp(jsonResponse({ "ok": true }))
	 * 			 }
	 * 	 )
	 * 	  })
	 * 	})
	 * ```
	 */
	namespace<TParams extends Params = Params>(
		path: IChemin<TParams>,
		routeModifier: (
			bldr: NamespaceBuilder<TData, BaseParams & TParams>,
		) => void,
	): this

	/**
	 * Registers a namespace using a function that modifies the namespace, and a function that adds routes to it
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
		X extends NamespaceBuilder<TData, BaseParams & TParams> =
			NamespaceBuilder<
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
		if (this.locked) throw new LockedNamespaceBuilder()
		this.graph.addNamespace(
			c.chemin(this.path, path) as IChemin<Params>,
			this.indexes,
			(bldr) => {
				// @ts-expect-error: useless Generics
				modifier(bldr)
				// @ts-expect-error: useless Generics
				secondModifier?.(bldr)
			},
		)
		return this
	}

	use<
		NewData extends Data | undefined = undefined,
	>(
		handler: MiddlewareHandler<
			BaseParams,
			TData extends undefined ? Data : TData,
			NewData
		>,
	): NamespaceBuilder<
		TData extends undefined ? NewData
			: (NewData extends undefined ? TEmptyObject
				: Merge<TData, NewData>),
		TParams,
		BaseParams
	> {
		if (this.locked) throw new LockedNamespaceBuilder()
		// @ts-expect-error: useless Generics
		this.middleware.add(handler)
		// @ts-expect-error: useless Generics
		return this
	}

	// @ts-expect-error: It works for now
	#route: RouteFunction<
		TData extends undefined ? Data : TData,
		Merge<BaseParams, TData>
	> = (
		path: IChemin,
		methodOrMethods: string | Record<string, Handler>,
		handler?: Handler,
	) => {
		if (this.locked) throw new LockedNamespaceBuilder()
		const fullPath = c.chemin(this.path, path)
		defaultRouteFunction(
			this.graph,
			fullPath,
			methodOrMethods,
			handler,
			this.indexes,
		)
	}

	route: RouteFunction<
		TData extends undefined ? Data : TData,
		Merge<BaseParams, TData>
	> = new Proxy(
		this.#route,
		(() => {
			const builder = this
			return {
				apply(target, thisArg, args) {
					if (builder.locked) throw new LockedNamespaceBuilder()
					// @ts-expect-error: it looks like `Proxy` doesn't provide types here
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
			}
		})(),
	)
}

export class RouteGraph extends InheritableCheminGraph<Node, FindData> {
	private middleware = new Set<MiddlewareHandler>()
	private namespaces = new Array<Namespace>()
	private namespace_index = 0

	constructor() {
		super((node, data) => node.method === data.method)
	}

	private composeMiddleware(node: Node, params: Params): Handler {
		const { handler, namespaceIndexes } = node
		const namespaceMiddlewareIterators = namespaceIndexes.map((index) =>
			this.namespaces[index].values()
		)
		const middlewares = concatIterators(
			this.middleware.values(),
			...namespaceMiddlewareIterators,
		)
		return (baseEvent) => {
			const data: Data = baseEvent.data
			Object.assign(params, baseEvent.params)
			const createNext = () => {
				return (
					nextData: Record<string, unknown>,
					request: Request,
				) => {
					Object.assign(data, nextData)
					const { done, value: currentMiddleware } = middlewares
						.next()
					if (done) {
						return useHandler(handler, request, params, data)
					}

					return useMiddleware(
						currentMiddleware,
						request,
						params,
						data,
						createNext(),
					)
				}
			}
			return createNext()(data, baseEvent.request).then(
				baseEvent.resp,
				baseEvent.err,
			)
		}
	}

	addRoute(
		method: string,
		path: IChemin,
		handler: Handler,
		namespaceIndexes?: number[],
	): void {
		super.pushNode(path, {
			path,
			method,
			handler,
			namespaceIndexes: namespaceIndexes ?? [],
		})
	}

	addNamespace(
		path: IChemin<Params>,
		baseIndexes: number[],
		builderFn: (bldr: NamespaceBuilder) => void,
	): void {
		const index = this.namespace_index++
		const bldr = new NamespaceBuilder(this, path, index, baseIndexes)
		builderFn(bldr)
		this.namespaces[index] = bldr[LOCK]()
	}

	pushMiddleware(middleware: MiddlewareHandler): void {
		this.middleware.add(middleware)
	}

	getHandler(
		pathname: string | string[],
		method: string,
	): Handler | undefined {
		const definition = super.getNode(pathname, { method })
		if (definition) {
			return this.composeMiddleware(
				definition.node,
				definition.params as Params,
			)
		}
	}
}

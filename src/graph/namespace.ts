import type {
	Data,
	Handler,
	Merge,
	MiddlewareHandler,
	Params,
	RouteFunction,
} from "@/export/types.ts"
import type { RouteGraph } from "@/graph/router.ts"
import type { TChemin, TEmptyObject } from "@/export/chemin.ts"
import { LockedNamespaceBuilder } from "@/export/error.ts"
import { defaultRouteFunction } from "@/common.ts"
import c from "@/export/chemin.ts"

export const LOCK = Symbol("LOCK")

export type Namespace = Set<MiddlewareHandler>

/**
 * Used to create namespaces
 */
export class NamespaceBuilder<
	INPUT_Data extends Data | undefined = undefined,
	TParams extends Params = Params,
	BaseParams extends Params = Params,
	TData extends Data = INPUT_Data extends undefined ? TEmptyObject
		: INPUT_Data,
> {
	private _locked = false

	/**
	 * Boolean denoting if the builder is locked.
	 */
	get locked(): boolean {
		return this._locked
	}
	private middleware: Set<MiddlewareHandler> = new Set()
	private indexes: number[]

	/**
	 * Create a new namespace builder
	 */
	constructor(
		private graph: RouteGraph,
		private path: TChemin<TParams>,
		private index: number,
		baseIndexes: number[],
	) {
		this.indexes = [this.index, ...baseIndexes]
	}

	/**
	 * @internal
	 * Locks a namespace
	 */
	[LOCK](): Namespace {
		this._locked = true
		return this.middleware
	}

	/**
	 * Registers a sub-namespace using a builder function
	 *
	 * @example no new middleware
	 * ```
	 * builder.namespace(chemin("group"), builder => {
	 * 		// ...
	 * })
	 * ```
	 * 	 * @example applying middleware
	 * ```
	 * builder.namespace(chemin("group"), builder => builder.use(useMiddleware), builder => {
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
		if (this.locked) throw new LockedNamespaceBuilder()
		this.graph.addNamespace(
			c.chemin(this.path, path) as TChemin<Params>,
			this.indexes,
			(bldr) => {
				// @ts-expect-error: The type of ISerialize is technically not different
				const mod = modifier(bldr)
				// @ts-expect-error: The types don't actually matter here, the builder is modified when middleware or routes are added.
				secondModifier?.(mod ?? bldr)
			},
		)
		return this
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

	// @ts-expect-error: The route function doesn't have it's indexes yet, but when it does once it's proxied.
	#route: RouteFunction<
		TData extends undefined ? Data : TData,
		Merge<BaseParams, TData>
	> = (
		path: TChemin,
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
							? ((path: TChemin, handler: Handler) =>
								target(path, prop, handler))
							: undefined)
				},
			}
		})(),
	)
}

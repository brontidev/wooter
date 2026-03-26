// deno-lint-ignore-file no-explicit-any
import type { TChemin } from "@dldc/chemin"
import type { Data, Methods, MiddlewareHandler, Params, RouteHandler } from "@@/types.ts"
import { CheminGraph } from "./CheminGraph.ts"
import RouteContext, { type InternalHandler, RouteContext__execution, RouteContext__respond } from "@/ctx/RouteContext.ts"
import MiddlewareContext from "@/ctx/MiddlewareContext.ts"

/**
 * Method definition accepted by `route` overloads.
 *
 * @internal
 */
export type MethodDefinitionInput = Methods | Uppercase<string> | Methods[] | Uppercase<string>[] | "*"

/**
 * Map of HTTP methods to handlers for a route.
 *
 * @internal
 */
export type MethodDefinitions<
	TParams extends Params,
	TData extends
		| Data
		| undefined = undefined,
> =
	& Partial<Record<Methods, RouteHandler<TParams, TData extends undefined ? Data : TData>>>
	& Record<Uppercase<string>, RouteHandler<TParams, TData extends undefined ? Data : TData>>

enum NodeType {
	MethodsToHandlers,
	AnyMethod,
	HandlerWithMethods,
}

type Node =
	| {
		t: NodeType.MethodsToHandlers
		handlers: Map<string, RouteHandler>
	}
	| { t: NodeType.AnyMethod; handler: RouteHandler }
	| { t: NodeType.HandlerWithMethods; handler: RouteHandler; methods: Set<string> }

export default class RouterGraph extends CheminGraph<Node, [method: string]> {
	/**
	 * Middleware chain attached to this router namespace.
	 */
	private middleware = new Set<MiddlewareHandler>()

	/**
	 * Child router namespaces mounted under this graph.
	 */
	private namespaces = new Set<RouterGraph>()

	/**
	 * Creates a router graph with method-aware node matching.
	 */
	constructor() {
		super((node, [method]) => {
			if (node.t === NodeType.MethodsToHandlers) {
				return node.handlers.has(method)
			} else if (node.t === NodeType.AnyMethod) {
				return true
			} else if (node.t === NodeType.HandlerWithMethods) {
				return node.methods.has(method)
			}
			throw new Error()
		})
	}

	/**
	 * Adds middleware to this namespace.
	 *
	 * @param middleware Middleware handler.
	 */
	addMiddleware(middleware: MiddlewareHandler<any, any, any>): void {
		this.middleware.add(middleware)
	}

	/**
	 * Registers a per-method handler map for a path.
	 *
	 * @param path Route path.
	 * @param handlers Method-to-handler map.
	 *
	 * @internal
	 */
	addRoute_withMethodMap(
		path: TChemin,
		handlers: MethodDefinitions<any, any>,
	) {
		super.addNode(path, {
			t: NodeType.MethodsToHandlers,
			handlers: new Map(
				Object.entries(handlers).map(([k, v]) => [k.toUpperCase(), v]),
			),
		})
	}

	/**
	 * Registers one handler for all methods on a path.
	 *
	 * @param path Route path.
	 * @param handler Route handler.
	 *
	 * @internal
	 */
	addRoute_wildcardMethod(
		path: TChemin,
		handler: RouteHandler<any, any>,
	) {
		super.addNode(path, {
			t: NodeType.AnyMethod,
			handler,
		})
	}

	/**
	 * Registers one handler for a finite method set.
	 *
	 * @param path Route path.
	 * @param handler Route handler.
	 * @param methods Allowed methods.
	 *
	 * @internal
	 */
	addRoute_withMethodSet(
		path: TChemin,
		handler: RouteHandler<any, any>,
		methods: Set<string>,
	) {
		super.addNode(path, {
			t: NodeType.HandlerWithMethods,
			handler,
			methods: new Set(methods.values().map((x) => x.toUpperCase())),
		})
	}

	/**
	 * Mounts a child namespace.
	 *
	 * @param routerGraph Child graph.
	 */
	addNamespace(routerGraph: RouterGraph) {
		this.namespaces.add(routerGraph)
	}

	/**
	 * Composes middleware and route handler into an executable internal handler.
	 *
	 * @param handler Final route handler.
	 * @param params Route params.
	 * @param middlewareSet Middleware chain.
	 * @returns Internal handler.
	 */
	protected static compose(handler: RouteHandler, params: Params, middlewareSet: Set<MiddlewareHandler>): InternalHandler {
		const middleware = middlewareSet.values()
		return (data, req) => {
			const createNext = (): InternalHandler => (nextData, req) => {
				Object.assign(data, nextData)
				const { done, value: currentMiddleware } = middleware.next()
				let currentHandler: InternalHandler
				if (done) {
					currentHandler = RouteContext.useRouteHandler(
						handler,
						params,
					)
				} else {
					// console.error("middleware is disabled")
					currentHandler = MiddlewareContext.useMiddlewareHandler(
						currentMiddleware,
						params,
						createNext(),
					)
				}

				return currentHandler(data, req)
			}
			return createNext()(data, req)
		}
	}

	/**
	 * Resolves a route handler from a matched node and HTTP method.
	 *
	 * @param node Matched node.
	 * @param method Uppercase HTTP method.
	 * @returns Route handler.
	 */
	protected static getHandlerFromNode(node: Node, method: string): RouteHandler {
		if (node.t === 0) {
			return node.handlers.get(method)!
		} else if (node.t === 1) {
			return node.handler
		} else if (node.t === 2) {
			return node.handler
		}
		// deno-coverage-ignore
		throw new TypeError("critical error loading routes")
	}

	/**
	 * Looks up handlers from child namespaces.
	 *
	 * @param pathname Request pathname.
	 * @param method Uppercase HTTP method.
	 * @returns Namespace handler tuple when found.
	 */
	protected getNamespaceHandler(pathname: string, method: string): ReturnType<RouterGraph["internalGetHandler"]> | undefined {
		for (const namespace of this.namespaces.values()) {
			const handler = namespace.internalGetHandler(pathname, method)
			if (handler) return handler
		}
	}

	/**
	 * Internal route lookup that includes inherited middleware context.
	 *
	 * @param pathname Request pathname.
	 * @param method Uppercase HTTP method.
	 * @returns Route handler, node metadata, and effective middleware chain.
	 */
	protected internalGetHandler(
		pathname: string,
		method: string,
	):
		| [handler: RouteHandler, nodeDef: NonNullable<ReturnType<RouterGraph["getNode"]>>, middleware: Set<MiddlewareHandler>]
		| undefined {
		const namespaceHandlerDef = this.getNamespaceHandler(pathname, method)
		if (namespaceHandlerDef) {
			const [handler, nodeDef, middleware] = namespaceHandlerDef
			return [handler, nodeDef, new Set([...this.middleware.values(), ...middleware.values()])]
		} else {
			const nodeDef = super.getNode(pathname, [method])
			if (!nodeDef) return undefined
			return [RouterGraph.getHandlerFromNode(nodeDef.node, method), nodeDef, this.middleware]
		}
	}

	/**
	 * Resolves an executable handler for a request target.
	 *
	 * @param pathname Request pathname.
	 * @param method HTTP method.
	 * @returns Internal handler, if a route matches.
	 */
	getHandler(pathname: string, method: string): InternalHandler | undefined {
		method = method.toUpperCase()
		const data = this.internalGetHandler(pathname, method)
		if (!data) return undefined
		const [handler, { params }, middleware] = data
		return RouterGraph.compose(handler, params as Params, middleware)
	}

	/**
	 * Executes an internal handler and returns its response promise.
	 *
	 * @param handler Internal handler.
	 * @param request Incoming request.
	 * @returns Promise resolving to the produced response.
	 */
	static runHandler(handler: InternalHandler, request: Request): Promise<Response> {
		const { promise, resolve, reject } = Promise.withResolvers<Response>()
		const ctx = handler({}, request)
		const execution = ctx[RouteContext__execution]
		const respond = ctx[RouteContext__respond]

		respond.then(resolve)
		execution.then((result) => {
			result.inspect((err) => {
				// no stray error should make it past this
				reject(err)
			})
		})

		return promise
	}
}

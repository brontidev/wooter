import { match } from "@/path/match.ts"
import type { Path } from "@/path/types.ts"
import type { Methods, RouteHandler, State } from "@@/types.ts"
import type { InternalHandler } from "@/ctx/RouteContext.ts"
import MiddlewareContext, { type MiddlewareHandler } from "@/ctx/MiddlewareContext.ts"
import RouteContext from "@/ctx/RouteContext.ts"

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
	TParams extends Record<string, unknown>,
	TState extends
		| State
		| undefined = undefined,
> =
	& Partial<Record<Methods, RouteHandler<TParams, TState extends undefined ? State : TState>>>
	& Record<Uppercase<string>, RouteHandler<TParams, TState extends undefined ? State : TState>>

enum NodeType {
	MethodsToHandlers,
	AnyMethod,
	HandlerWithMethods,
}

export type Node =
	& (
		| {
			t: NodeType.MethodsToHandlers
			handlers: Map<string, RouteHandler>
		}
		| { t: NodeType.AnyMethod; handler: RouteHandler }
		| { t: NodeType.HandlerWithMethods; handler: RouteHandler; methods: Set<string> }
	)
	& { path: Path }

export type Namespace = {
	path: Path
	graph: Graph
}

export class Graph {
	private nodes = new Set<Node>()
	private middleware = new Set<MiddlewareHandler>()
	private namespaces = new Set<Namespace>()

	constructor(private basePath?: Path) {}

	addMiddleware(handler: MiddlewareHandler<any, any, any>) {
		this.middleware.add(handler)
	}

	addNamespace(path: Path, graph: Graph) {
		this.namespaces.add({
			graph,
			path,
		})
	}

	addNode(node: Node) {
		this.nodes.add(node)
	}

	addRoute_wildcardMethod(path: Path, handler: RouteHandler<any, any>) {
		this.addNode({
			t: NodeType.AnyMethod,
			path,
			handler,
		})
	}

	addRoute_withMethodSet(path: Path, handler: RouteHandler<any, any>, methods: Set<string>) {
		this.addNode({
			t: NodeType.HandlerWithMethods,
			path,
			handler,
			methods,
		})
	}

	addRoute_withMethodMap(path: Path, handlers: Record<string, RouteHandler<any, any>>) {
		this.addNode({
			t: NodeType.MethodsToHandlers,
			handlers: new Map(
				Object.entries(handlers).map(([k, v]) => [k.toUpperCase(), v]),
			),
			path,
		})
	}

	protected internalGetHandler(
		path: string[],
		i: number,
		method: string,
	): { handler: RouteHandler; params: Record<string, any>; middleware: MiddlewareHandler[] } | undefined {
		for (const namespace of this.namespaces) {
			const namespaceResult = match(path, i, namespace.path, false)
			if (!namespaceResult.match) continue

			const childResult = namespace.graph.internalGetHandler(path, namespaceResult.stopped_at, method)
			if (!childResult) continue

			return {
				handler: childResult.handler,
				params: { ...namespaceResult.params, ...childResult.params },
				middleware: [...this.middleware, ...childResult.middleware],
			}
		}

		for (const node of this.nodes) {
			let handler: RouteHandler | undefined
			if (node.t === NodeType.MethodsToHandlers) {
				const _handler = node.handlers.get(method)
				if (!_handler) continue
				handler = _handler
			} else if (node.t === NodeType.AnyMethod) {
				handler = node.handler
			} else if (node.t === NodeType.HandlerWithMethods) {
				if (!node.methods.has(method)) continue
				handler = node.handler
			} else {
				throw new TypeError("invalid configuration")
			}

			const result = match(path, i, node.path, true)

			if (!result.match) continue
			if (!handler) continue
			return { handler, params: result.params, middleware: [...this.middleware] }
		}
	}

	getHandler(pathname: string, method: string): InternalHandler | undefined {
		method = method.toUpperCase()
		const path = pathname.split("/")
		if (path[0] == "") path.shift()
		if (path[path.length - 1] == "") path.pop()

		let i = 0
		const params = {}

		if (this.basePath) {
			const result = match(path, i, this.basePath, false)
			if (!result.match) return
			Object.assign(params, result.params)
			i = result.stopped_at
		}

		const result = this.internalGetHandler(path, i, method)
		if (!result) return
		Object.assign(params, result.params)
		return Graph.compose(result.handler, params, result.middleware)
	}

	/**
	 * Composes middleware and route handler into an executable internal handler.
	 *
	 * @param handler Final route handler.
	 * @param params Route params.
	 * @param middlewareSet Middleware chain.
	 * @returns Internal handler.
	 */
	protected static compose(
		handler: RouteHandler,
		params: Record<string, unknown>,
		middlewareSet: readonly MiddlewareHandler[],
	): InternalHandler {
		const middleware = middlewareSet.values()
		return (state, req) => {
			const createNext = (): InternalHandler => (nextState, req) => {
				Object.assign(state, nextState)
				const { done, value: currentMiddleware } = middleware.next()
				let currentHandler: InternalHandler
				if (done) {
					currentHandler = RouteContext.useRouteHandler(
						handler,
						params,
					)
				} else {
					currentHandler = MiddlewareContext.useMiddlewareHandler(
						currentMiddleware,
						params,
						createNext(),
					)
				}

				return currentHandler(state, req)
			}
			return createNext()(state, req)
		}
	}
}

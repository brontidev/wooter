import type { TChemin } from "@dldc/chemin"
import type { Data, Methods, MiddlewareHandler, Params, RouteHandler } from "@/export/types.ts"
import { InheritableCheminGraph } from "./InheritableCheminGraph.ts"
import { type InternalHandler, RouteContext__block, RouteContext__respond } from "@/ctx/RouteContext.ts"
import MiddlewareContext from "@/ctx/MiddlewareContext.ts"

/**
 * @internal
 */
export type MethodDefinitionInput = Methods | Uppercase<string> | Methods[] | Uppercase<string>[] | "*"

/**
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

type Node =
	| {
		t: 0
		handlers: Map<string, RouteHandler>
	}
	| { t: 1; handler: RouteHandler }
	| { t: 2; handler: RouteHandler; methods: Set<string> }

export default class RouterGraph extends InheritableCheminGraph<Node, [method: string]> {
	private middleware = new Set<MiddlewareHandler>()
	private namespaces = new Set<RouterGraph>()

	constructor() {
		super((node, [method]) => {
			if (node.t === 0) {
				return node.handlers.has(method)
			} else if (node.t === 1) {
				return true
			} else if (node.t === 2) {
				return node.methods.has(method)
			}
			throw new Error()
		})
	}

	// deno-lint-ignore no-explicit-any
	addMiddleware(middleware: MiddlewareHandler<any, any, any>): void {
		this.middleware.add(middleware)
	}

	addRoute_type0(
		path: TChemin,
		// deno-lint-ignore no-explicit-any
		handlers: MethodDefinitions<any, any>,
	) {
		super.addNode(path, {
			t: 0,
			handlers: new Map(
				Object.entries(handlers).map(([k, v]) => [k.toLowerCase(), v]),
			),
		})
	}

	addRoute_type1(
		path: TChemin,
		// deno-lint-ignore no-explicit-any
		handler: RouteHandler<any, any>,
	) {
		super.addNode(path, {
			t: 1,
			handler,
		})
	}

	addRoute_type2(
		path: TChemin,
		// deno-lint-ignore no-explicit-any
		handler: RouteHandler<any, any>,
		methods: string[],
	) {
		super.addNode(path, {
			t: 2,
			handler,
			methods: new Set(methods),
		})
	}

	addNamespace(routerGraph: RouterGraph) {
		this.namespaces.add(routerGraph)
	}

	protected static compose(handler: RouteHandler, params: Params, middlewareSet: Set<MiddlewareHandler>): InternalHandler {
		const middleware = middlewareSet.values()
		return (data, req) => {
			const createNext = (): InternalHandler => (nextData, req) => {
				Object.assign(data, nextData)
				const { done, value: currentMiddleware } = middleware.next()
				let currentHandler: InternalHandler
				if (done) {
					currentHandler = MiddlewareContext.useRouteHandler(
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

				return currentHandler(data, req)
			}
			return createNext()(data, req)
		}
	}

	protected static getHandlerFromNode(node: Node, method: string) {
		if (node.t === 0) {
			return node.handlers.get(method)
		} else if (node.t === 1) {
			return node.handler
		} else if (node.t === 2) {
			return node.methods.has(method) && node.handler
		}
	}

	protected getNamespaceHandler(pathname: string, method: string): ReturnType<RouterGraph["internalGetHandler"]> | undefined {
		for (const namespace of this.namespaces.values()) {
			const handler = namespace.internalGetHandler(pathname, method)
			if (handler) return handler
		}
	}

	// protected getHandlerDefinition(
	// 	pathname: string,
	// 	method: string,
	// ): [InternalHandler, ReturnType<RouterGraph["getNode"]>] | undefined {
	// 	const definition = super.getNode(pathname, [method])
	// 	if (!definition) return undefined
	// 	const handler = RouterGraph.getHandlerFromNode(definition.node, method)
	// 	if (!handler) return undefined
	// 	return [this.compose(handler, definition.params as Params), definition]
	// }

	// getHandler(pathname: string, method: string): InternalHandler | undefined {
	// 	method = method.toUpperCase()
	// 	let handler: InternalHandler | undefined = undefined
	// 	handler = this.getNamespaceHandler(pathname, method)
	// 	if (!handler) {
	// 		const handlerDefinition = this.getHandlerDefinition(pathname, method)
	// 		if (handlerDefinition) {
	// 			handler = handlerDefinition[0]
	// 		}
	// 	}
	// 	if (!handler) return undefined
	// 	return handler
	// }
	//

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
			const handler = RouterGraph.getHandlerFromNode(nodeDef.node, method)
			if (!handler) return undefined
			return [handler, nodeDef, this.middleware]
		}
	}

	getHandler(pathname: string, method: string): InternalHandler | undefined {
		method = method.toUpperCase()
		const data = this.internalGetHandler(pathname, method)
		if (!data) return undefined
		const [handler, { params }, middleware] = data
		return RouterGraph.compose(handler, params as Params, middleware)
	}

	static runHandler(handler: InternalHandler, request: Request): Promise<Response> {
		const { promise, resolve, reject } = Promise.withResolvers<Response>()
		const ctx = handler({}, request)
		ctx[RouteContext__respond].promise.then((v) => {
			v.match(
				(v) => resolve(v),
				() => {
					ctx[RouteContext__block].promise.then((e) => reject(e.unwrapErr()))
				},
			)
		})
		ctx[RouteContext__block].promise.then((v) => {
			v.match(
				(v) => v,
				(e) => {
					if (ctx[RouteContext__respond].resolved) console.error("Uncaught error in handler (after response): ", e)
					reject(e)
				},
			)
		})
		return promise
	}
}

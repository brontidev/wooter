import type { TChemin } from "@dldc/chemin"
import type { Methods, MiddlewareHandler, Params, RouteHandler } from "../export/types.ts"
import { InheritableCheminGraph } from "./InheritableCheminGraph.ts"
import type { InternalHandler } from "../ctx/RouteContext.ts"
import MiddlewareContext from "@/ctx/MiddlewareContext.ts"

type Node = {
	handlers: Map<string, RouteHandler>
}

export default class RouterGraph extends InheritableCheminGraph<Node, [method: string]> {
	private middleware = new Set<MiddlewareHandler>()

	constructor() {
		super((node, [method]) => node.handlers.has(method))
	}

	addMiddleware(middleware: MiddlewareHandler): void {
		this.middleware.add(middleware)
	}

	addRoute(
		path: TChemin,
		handlers:
			& Partial<
				Record<
					Methods,
					RouteHandler
				>
			>
			& Record<Uppercase<string>, RouteHandler>,
	) {
		super.addNode(path, {
			handlers: new Map(
				Object.entries(handlers).map(([k, v]) => [k.toLowerCase(), v]),
			),
		})
	}

	private compose(handler: RouteHandler, params: Params): InternalHandler {
		const middleware = this.middleware.values()
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

	getHandler(pathname: string, method: string): InternalHandler | undefined {
		method = method.toUpperCase()
		const definition = super.getNode(pathname, [method])
		if (!definition) return undefined
		const handler = definition.node.handlers.get(method)
		if (!handler) return undefined
		return this.compose(handler, definition.params as Params)
	}
}

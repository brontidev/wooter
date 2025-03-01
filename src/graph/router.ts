import { InheritableCheminGraph } from "@/graph/basic.ts"
import type { IChemin } from "@/export/chemin.ts"
import type {
	Data,
	Handler,
	MiddlewareHandler,
	Params,
} from "@/export/types.ts"
import { useHandler } from "@/event/index.ts"
import { useMiddleware } from "@/event/middleware.ts"

type Node = { path: IChemin<Params>; method: string; handler: Handler }
type FindData = { method: string }

export class RouteGraph
	extends InheritableCheminGraph<Node, FindData, RouteGraph> {
	private middleware = new Set<MiddlewareHandler>()

	constructor() {
		super((node, data) => node.method === data.method)
	}

	private composeMiddleware(node: Node, params: Params): Handler {
		const middleware = this.middleware.values().toArray()
		const { handler } = node
		return (baseEvent) => {
			const data: Data = baseEvent.data
			Object.assign(params, baseEvent.params)
			const createNext = (idx: number) => {
				return (
					nextData: Record<string, unknown>,
					request: Request,
				) => {
					Object.assign(data, nextData)

					if (idx >= middleware.length) {
						return useHandler(handler, request, params, data)
					}
					return useMiddleware(
						middleware[idx],
						request,
						params,
						data,
						createNext(idx + 1),
					)
				}
			}
			return createNext(0)(data, baseEvent.request).then(
				baseEvent.resp,
				baseEvent.err,
			)
		}
	}

	addRoute(method: string, path: IChemin, handler: Handler): void {
		super.pushNode(path, { path, method, handler })
	}

	addNamespace(
		path: IChemin<Params>,
		matcher: () => RouteGraph,
	): void {
		super.pushSubgraph(path, matcher)
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

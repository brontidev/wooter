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
import { LOCK, type Namespace, NamespaceBuilder } from "@/graph/namespace.ts"
import { concatIterators } from "@/common.ts"

type Node = {
	path: IChemin<Params>
	method: string
	handler: Handler
	namespaceIndexes: number[]
}
type FindData = { method: string }

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

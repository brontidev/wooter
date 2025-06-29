import { InheritableCheminGraph } from "@/graph/basic.ts"
import type { TChemin, TEmptyObject } from "@/export/chemin.ts"
import type {
	Data,
	MiddlewareHandler,
	Params,
	RouteHandler,
} from "@/export/types.ts"
import { RouteContext, runHandler /*useHandler*/ } from "@/context/index.ts"
import {
	MiddlewareContext,
	runMiddleware, /*useMiddleware*/
} from "@/context/middleware.ts"
import { LOCK, type Namespace, NamespaceBuilder } from "@/graph/namespace.ts"
import { concatIterators } from "@/common.ts"
import type { Result } from "@oxi/result"
import { promiseResult } from "../promise.ts"

type Node = {
	path: TChemin<Params>
	method: string
	handler: RouteHandler
	namespaceIndexes: number[]
}
type FindData = { method: string }

export type Run = (
	request: Request,
	data: Data,
	params: Params,
) => ReturnType<Up>
export type Up<TData extends Data | undefined = undefined> = (
	nextData: Data,
	request: Request,
) => readonly [
	RouteContext<Params, TData extends undefined ? TEmptyObject : TData>,
	Promise<Result<void, unknown>>,
]

export class RouteGraph extends InheritableCheminGraph<Node, FindData> {
	private middleware = new Set<MiddlewareHandler>()
	private namespaces = new Array<Namespace>()
	private namespace_index = 0

	constructor() {
		super((node, data) => node.method === data.method.toUpperCase())
	}

	private composeMiddleware(node: Node, params: Params): Run {
		const { handler, namespaceIndexes } = node
		const namespaceMiddlewareIterators = namespaceIndexes.map((index) =>
			this.namespaces[index].values()
		)
		const middlewares = concatIterators(
			this.middleware.values(),
			...namespaceMiddlewareIterators,
		)

		return (request, data, new_params) => {
			Object.assign(params, new_params)
			// const createNext = () => {
			// 	return (
			// 		nextData: Record<string, unknown>,
			// 		request: Request,
			// 	) => {
			// 		Object.assign(data, nextData)
			// 		const { done, value: currentMiddleware } = middlewares
			// 			.next()
			// 		if (done) {
			// 			return useHandler(handler, request, params, data)
			// 		}

			// 		return useMiddleware(
			// 			currentMiddleware,
			// 			request,
			// 			params,
			// 			data,
			// 			createNext(),
			// 		)
			// 	}
			// }
			// return createNext()(data, request)

			const createUp = (): Up<Data> => {
				return (nextData: Data, request: Request) => {
					Object.assign(data, nextData)
					const { done, value: currentMiddleware } = middlewares
						.next()
					if (done) {
						const context = new RouteContext(request, params, data)
						return [context, runHandler(context, handler)] as const
					}

					const context = new MiddlewareContext(
						request,
						params,
						data,
						createUp(),
					)

					return [
						context,
						runMiddleware(context, currentMiddleware),
					] as const
				}
			}
			return createUp()(data, request)
		}
	}

	addRoute(
		method: string,
		path: TChemin,
		handler: RouteHandler,
		namespaceIndexes?: number[],
	): void {
		super.pushNode(path, {
			path,
			method: method.toUpperCase(),
			handler,
			namespaceIndexes: namespaceIndexes ?? [],
		})
	}

	addNamespace(
		path: TChemin<Params>,
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
	): Run | undefined {
		const definition = super.getNode(pathname, { method })
		if (definition) {
			return this.composeMiddleware(
				definition.node,
				definition.params as Params,
			)
		}
	}
}

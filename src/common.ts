// Functions common to the Wooter and the NamespaceBuilder

import type { TChemin } from "@/export/chemin.ts"
import type { RouteHandler } from "@/export/types.ts"
import type { RouteGraph } from "@/graph/router.ts"

export function defaultRouteFunction(
	graph: RouteGraph,
	path: TChemin,
	methodOrMethods: string | Record<string, RouteHandler>,
	handler?: RouteHandler,
	namespaceIndexes?: number[],
) {
	if (typeof methodOrMethods === "string" && !!handler) {
		graph.addRoute(methodOrMethods, path, handler, namespaceIndexes)
	} else if (typeof methodOrMethods === "object") {
		Object.entries(methodOrMethods).forEach(([method, handler]) => {
			graph.addRoute(method, path, handler, namespaceIndexes)
		})
	}
}

export function* concatIterators<T>(
	...iterators: Iterable<T, unknown, undefined>[]
): Generator<T, void, undefined> {
	for (const iterator of iterators) {
		for (const element of iterator) {
			yield element
		}
	}
}

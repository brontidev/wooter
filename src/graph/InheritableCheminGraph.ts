import { matchExact as matchCheminExact, splitPathname, type TChemin } from "@/export/chemin.ts"
import type { RouteHandler } from "../export/types.ts"

/**
 * A chemin based graph that will match nodes to a pathname
 * All elements are protected (for inheritance), to use the graph directly, use {@linkcode CheminGraph}
 */
export class InheritableCheminGraph<
	Node,
	FindData,
> {
	private nodes = new Set<{ path: TChemin; node: Node }>()

	/**
	 * Construct a new graph
	 * @param dataMatcher Callback that returns true if a node matches the data
	 */
	constructor(
		protected dataMatcher: (node: Node, data: FindData) => boolean,
	) {}

	/**
	 * Adds a node to the graph
	 * @param path Chemin to match
	 * @param node Node
	 */
	protected addNode(path: TChemin, node: Node) {
		this.nodes.add({ path, node })
	}

	/**
	 * Matches a node from a pathname
	 * @param pathname Pathname or Path parts
	 * @param data Extra check data
	 * @returns Node Definition
	 */
	protected getNode(
		pathname: string | string[],
		data: FindData,
	): { params: unknown; node: Node } | undefined {
		const pathParts = Array.isArray(pathname) ? pathname : splitPathname(pathname)

		for (const { node, path } of this.nodes) {
			if (!this.dataMatcher(node, data)) continue
			const params = matchCheminExact(path, pathParts)
			if (!params) continue
			return { params, node }
		}
	}
}

import type { TChemin } from "@@/chemin.ts"

/**
 * Path graph keyed by `chemin` patterns.
 *
 * @typeParam Node Node payload type stored in the graph.
 * @typeParam FindData Extra data used during node filtering.
 */
export class CheminGraph<
	Node,
	FindData,
> {
	/**
	 * Registered graph nodes and their associated path patterns.
	 */
	private nodes = new Set<{ path: TChemin; node: Node }>()

	/**
	 * Creates a graph with a custom node matcher.
	 *
	 * @param dataMatcher Predicate used to decide whether a node is eligible for a lookup.
	 */
	constructor(
		protected dataMatcher: (node: Node, data: FindData) => boolean,
	) {}

	/**
	 * Adds a node to the graph.
	 *
	 * @param path Path matcher for this node.
	 * @param node Node payload.
	 */
	protected addNode(path: TChemin, node: Node) {
		this.nodes.add({ path, node })
	}

	/**
	 * Finds the first node that matches both filter data and pathname.
	 *
	 * @param pathname URL pathname to resolve.
	 * @param data Extra matcher data.
	 * @returns Matching node and extracted params, if found.
	 */
	protected getNode(
		pathname: string,
		data: FindData,
	): { params: unknown; node: Node } | undefined {
		for (const { node, path } of this.nodes) {
			if (!this.dataMatcher(node, data)) continue
			const params = path.matchExact(pathname)
			if (!params) continue
			return { params, node }
		}
	}
}

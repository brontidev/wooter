import { matchExact as matchCheminExact, type TChemin } from "@@/chemin.ts"

/**
 * A chemin based graph that will match nodes to a pathname
 */
export class CheminGraph<
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
		pathname: string,
		data: FindData,
	): { params: unknown; node: Node } | undefined {
		for (const { node, path } of this.nodes) {
			if (!this.dataMatcher(node, data)) continue
			const params = matchCheminExact(path, pathname)
			if (!params) continue
			return { params, node }
		}
	}
}

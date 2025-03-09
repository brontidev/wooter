import {
	type IChemin,
	matchExact as matchCheminExact,
	splitPathname,
} from "@/export/chemin.ts"

/**
 * A chemin based graph that will match nodes to a pathname
 * All elements are protected (for inheritance), to use the graph directly, use {@linkcode CheminGraph}
 */
export class InheritableCheminGraph<
	Node,
	FindData,
> {
	private nodes = new Set<{ path: IChemin; node: Node }>()

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
	protected pushNode(path: IChemin, node: Node) {
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
		const pathParts = Array.isArray(pathname)
			? pathname
			: splitPathname(pathname)

		for (const { node, path } of this.nodes) {
			if (!this.dataMatcher(node, data)) continue
			const params = matchCheminExact(path, pathParts)
			if (!params) continue
			return { params, node }
		}
	}
}

/**
 * Constructable
 */
export class CheminGraph<
	Node,
	FindData,
> extends InheritableCheminGraph<Node, FindData> {
	/**
	 * Matches a node from a pathname
	 * @param pathname Pathname or Path parts
	 * @param data Extra check data
	 * @returns Node Definition
	 */
	override getNode(
		pathname: string | string[],
		data: FindData,
	): { params: unknown; node: Node } | undefined {
		return super.getNode(pathname, data)
	}
	/**
	 * Adds a node to the graph
	 * @param path Chemin to match
	 * @param node Node
	 */
	override pushNode(path: IChemin, node: Node): void {
		super.pushNode(path, node)
	}
}

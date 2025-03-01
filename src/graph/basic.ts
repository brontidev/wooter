import {
	type IChemin,
	match as matchChemin,
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
	This = InheritableCheminGraph<Node, FindData, unknown>,
> {
	private nodes = new Set<{ path: IChemin; node: Node }>()

	private subGraphs = new Set<
		{ path: IChemin; match: () => This }
	>()

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
	 * Adds a subgraph to the graph
	 * @param path Chemin to match
	 * @param match Callback that returns a subgraph
	 *
	 * Refrain from creating the graph inside the callback, as it will be called multiple times
	 */
	protected pushSubgraph(path: IChemin, match: () => This) {
		this.subGraphs.add({ path, match })
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

		for (const { path, match } of this.subGraphs) {
			const matchValue = matchChemin(path, pathParts)
			if (!matchValue) continue
			const { params: parentParams } = matchValue
			const graph = match() as unknown as this
			const definition = graph.getNode(matchValue.rest as string[], data)
			if (!definition) continue
			const { params: childParams, node } = definition
			const params = Object.assign(parentParams, childParams)
			return { params, node }
		}

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
	This = InheritableCheminGraph<Node, FindData, unknown>,
> extends InheritableCheminGraph<Node, FindData, This> {
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
	/**
	 * Adds a subgraph to the graph
	 * @param path Chemin to match
	 * @param match Callback that returns a subgraph
	 *
	 * Refrain from creating the graph inside the callback, as it will be called multiple times
	 */
	override pushSubgraph(path: IChemin, match: () => This): void {
		super.pushSubgraph(path, match)
	}
}

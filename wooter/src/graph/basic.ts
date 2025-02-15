import {
	type IChemin,
	match as matchChemin,
	matchExact as matchCheminExact,
	splitPathname,
} from "@/export/chemin.ts"

export class CheminGraph<
	Node,
	FindData,
	This = CheminGraph<Node, FindData, unknown>,
> {
	private nodes = new Set<{ path: IChemin; node: Node }>()

	private subgraphs = new Set<
		{ path: IChemin; match: () => This }
	>()

	constructor(private dataMatcher: (node: Node, data: FindData) => boolean) {}

	protected pushNode(path: IChemin, node: Node) {
		this.nodes.add({ path, node })
	}

	protected pushSubgraph(path: IChemin, match: () => This) {
		this.subgraphs.add({ path, match })
	}

	protected getNode(
		pathname: string | string[],
		data: FindData,
	): { params: unknown; node: Node } | undefined {
		const pathParts = Array.isArray(pathname)
			? pathname
			: splitPathname(pathname)

		for (const { path, match } of this.subgraphs) {
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

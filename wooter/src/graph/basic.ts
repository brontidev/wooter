import {
	type IChemin,
	type ICheminMatch,
	match as matchChemin,
	matchExact as matchCheminExact,
	splitPathname,
} from "@/export/chemin.ts"

export type Matcher<Node, FindData> = (
	match: ICheminMatch<unknown>,
	data: FindData,
) => Node | undefined

export class CheminGraph<Node, FindData> {
	private nodes = new Set<{ path: IChemin; node: Node }>()

	private subgraphs = new Set<
		{ path: IChemin; match: Matcher<Node, FindData> }
	>()

	constructor(private dataMatcher: (node: Node, data: FindData) => boolean) {}

	protected pushNode(path: IChemin, node: Node) {
		this.nodes.add({ path, node })
	}

	protected pushSubgraph(path: IChemin, match: Matcher<Node, FindData>) {
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
			const { params } = matchValue
			const node = match(matchValue, data)
			if (!node) continue // This namespace doesn't have that route, continue to next
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

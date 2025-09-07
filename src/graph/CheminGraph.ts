import type { TChemin } from "@/export/chemin.ts"
import { InheritableCheminGraph } from "./InheritableCheminGraph.ts"

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
	override addNode(path: TChemin, node: Node): void {
		super.addNode(path, node)
	}
}

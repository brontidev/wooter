import type { Data, Params } from "@/export/types.ts"
import { createResolvers, type Resolvers } from "@/promise.ts"

export const SymbolResolvers = Symbol("event_Resolvers")

/**
 * Event class passed into route handlers
 */
export class RouteEvent<
	TParams extends Params = Params,
	TData extends Data = Data,
> {
	private resolvers: Resolvers<Response>

	/**
	 * Request URL
	 */
	readonly url: URL

	/**
	 * Respond function
	 *
	 * @example
	 * ```ts
	 * resp(new Response("Hello World!"))
	 * ```
	 */
	get resp(): (response: Response | PromiseLike<Response>) => void {
		return this.resolvers.resolve
	}

	/**
	 * Rejects
	 */
	get err(): (err?: unknown) => void {
		return this.resolvers.reject
	}

	/**
	 * Promise used to evaluate response, used internally to send response to the client
	 */
	get promise(): Promise<Response> {
		return this.resolvers.promise
	}

	/**
	 * @internal
	 */
	get [SymbolResolvers](): Resolvers<Response> {
		return this.resolvers
	}

	/**
	 * Creates a new Event
	 * @param request Request
	 * @param params Parameters
	 * @param data Wooter data
	 */
	constructor(
		readonly request: Request,
		readonly params: TParams,
		readonly data: TData,
	) {
		this.resolvers = createResolvers()
		this.url = new URL(request.url)
	}
}
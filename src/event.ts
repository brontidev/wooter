/**
 * Event class passed into route handlers
 */
export class Event<
	TParams extends Record<string, unknown> = Record<string, unknown>,
	TData extends Record<string, unknown> = Record<string, unknown>,
> {
	private resolvers: PromiseWithResolvers<Response>

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
		this.resolvers = Promise.withResolvers()
	}
}

/**
 * Event class passed into middleware handlers
 */
export class MiddlewareEvent<
	TParams extends Record<string, unknown> = Record<string, unknown>,
	TData extends Record<string, unknown> = Record<string, unknown>,
	TNextData extends Record<string, unknown> = Record<string, unknown>,
> extends Event<TParams, TData> {
	private hasCalledUp = false

	/**
	 * Evaluates the next handler
	 * @param data New data
	 * @returns Repsonse from the handler
	 */
	get up(): (data?: TNextData) => Promise<Response> {
		return this._up.bind(this)
	}

	/**
	 * Creates a new Middleware Event
	 * @param request Request
	 * @param params Parameters
	 * @param data Wooter Data
	 * @param next Next Function
	 */
	constructor(
		override readonly request: Request,
		override readonly params: TParams,
		override readonly data: TData,
		private readonly next: (data: TNextData) => Promise<Response>,
	) {
		super(request, params, data)
	}

	/**
	 * Evaluates the next handler
	 * @param data New data
	 * @returns Repsonse from the handler
	 */
	private async _up(data?: TNextData): Promise<Response> {
		if (this.hasCalledUp) {
			throw new Error("up() was called more than once")
		}
		this.hasCalledUp = true
		const response = await this.next(data ?? {} as TNextData)
		this.resp(response)
		return response
	}
}

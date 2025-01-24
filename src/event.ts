export class Event<
	TParams extends Record<string, unknown> = Record<string, unknown>,
	TData extends Record<string, unknown> = Record<string, unknown>,
> {
	private resolvers: PromiseWithResolvers<Response>

	get resp(): (response: Response | PromiseLike<Response>) => void {
		return this.resolvers.resolve
	}

	get err(): (err?: unknown) => void {
		return this.resolvers.reject
	}

	get promise(): Promise<Response> {
		return this.resolvers.promise
	}

	constructor(
		readonly request: Request,
		readonly params: TParams,
		readonly data: TData,
	) {
		this.resolvers = Promise.withResolvers()
	}
}

// TODO: implement up function
export class MiddlewareEvent<
	TParams extends Record<string, unknown> = Record<string, unknown>,
	TData extends Record<string, unknown> = Record<string, unknown>,
	TNextData extends Record<string, unknown> = Record<string, unknown>,
> extends Event<TParams, TData> {
	private hasCalledUp = false

	constructor(
		override readonly request: Request,
		override readonly params: TParams,
		override readonly data: TData,
		private readonly next: (data: TNextData) => Promise<Response>,
	) {
		super(request, params, data)
	}

	async up(data?: TNextData): Promise<Response> {
		if (this.hasCalledUp) {
			throw new Error("up() was called more than once")
		}
		this.hasCalledUp = true
		const response = await this.next(data ?? {} as TNextData)
		this.resp(response)
		return response
	}
}

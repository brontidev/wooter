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

export class MiddlewareEvent extends Event {
}

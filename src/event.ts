import { MiddlewareCalledUpTooManyTimes } from "./export/error.ts"
import type { Data, Params } from "./export/types.ts"

/**
 * Event class passed into route handlers
 */
export class Event<
	TParams extends Params = Params,
	TData extends Data = Data,
> {
	private resolvers: PromiseWithResolvers<Response>

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
		this.url = new URL(request.url)
	}
}

/**
 * Event class passed into middleware handlers
 */
export class MiddlewareEvent<
	TParams extends Params = Params,
	TData extends Data = Data,
	TNextData extends Data | undefined = Data,
> extends Event<TParams, TData> {
	private hasCalledUp = false
	private _storedResponse: Response | undefined

	/**
	 * Evaluates the next handler
	 * @param data New data
	 * @returns Repsonse from the handler
	 */
	get up(): TNextData extends undefined ? (() => Promise<Response>)
		: ((data: TNextData) => Promise<Response>) {
		// @ts-ignore: this is typescripts fault
		return this._up.bind(this)
	}

	/**
	 * Stored response from the next handler
	 */
	get storedResponse(): Response | undefined {
		return this._storedResponse
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
		private readonly next: (
			data: TNextData,
			request: Request,
		) => Promise<Response>,
	) {
		super(request, params, data)
	}

	/**
	 * Evaluates the next handler
	 * @param data Added data
	 * @param request New Request
	 * @returns Repsonse from the handler
	 */
	private async _up(data: TNextData, request?: Request): Promise<Response> {
		if (this.hasCalledUp) {
			throw new MiddlewareCalledUpTooManyTimes()
		}
		this.hasCalledUp = true
		const response = await this.next(
			data,
			(request ?? this.request).clone(),
		)
		this._storedResponse = response
		return response
	}
}

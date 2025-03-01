import type { Data, MiddlewareHandler, Params } from "@/export/types.ts"
import { RouteEvent, SymbolResolvers } from "@/event/index.ts"
import {
	MiddlewareCalledUpTooManyTimes,
	MiddlewareDidntCallUp,
} from "@/export/error.ts"

/**
 * Event class passed into middleware handlers
 */
export class MiddlewareEvent<
	TParams extends Params = Params,
	TData extends Data = Data,
	TNextData extends Data | undefined = Data,
> extends RouteEvent<TParams, TData> {
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

export function useMiddleware(
	middlewareHandler: MiddlewareHandler,
	request: Request,
	params: Params,
	data: Data,
	next: (
		data: Data,
		request: Request,
	) => Promise<Response>,
) {
	const event = new MiddlewareEvent(
		request,
		params,
		data,
		next,
	)

	queueMicrotask(async () => {
		try {
			await middlewareHandler(event)
			if (event[SymbolResolvers].state === "pending") {
				if (!event.storedResponse) {
					return event.err(
						new MiddlewareDidntCallUp(),
					)
				}
				event.resp(event.storedResponse)
			}
		} catch (e) {
			event.err(e)
		}
	})
	return event.promise
}

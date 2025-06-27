import type { Data, Params, RouteHandler } from "@/export/types.ts"

import { ExitWithoutResponse } from "@/export/error.ts"
import { Result } from "@oxi/result"
import { promiseResult } from "../promise.ts"

export const Context__hasValue = Symbol("ctx.hasValue")
export const Context__resolve = Symbol("ctx.resolve")
export const Context__chain = Symbol("ctx.chain")

/**
 * Context class passed into route handlers
 */
export class RouteContext<
	TParams extends Params = Params,
	TData extends Data = Data,
> {
	// private resolvers: Resolvers<Response>

	protected handler?: (result: Result<Response, unknown>) => void
	private _value: Result<Response, unknown> | undefined

	protected set value(value: Result<Response, unknown>) {
		this._value = value
		this.handler?.(value)
	}

	protected get value(): Result<Response, unknown> | undefined {
		return this._value
	}

	get [Context__hasValue]() {
		return this.value !== undefined
	}

	[Context__resolve](handler: (result: Result<Response, unknown>) => void) {
		if (this.value === undefined) {
			this.handler = handler
		} else {
			handler(this.value)
		}
	}

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
	readonly resp = (response: Response) => {
		if (!this._value) {
			this.value = Result.Ok(response)
		}
	}
	/**
	 * Rejects
	 */
	readonly err = (err?: unknown) => {
		if (!this._value) {
			this.value = Result.Err(err)
		}
	}

	/**
	 * Creates a new Context
	 * @param request Request
	 * @param params Parameters
	 * @param data Wooter data
	 */
	constructor(
		readonly request: Request,
		readonly params: TParams,
		readonly data: TData,
	) {
		this.url = new URL(request.url)
	}
}

export function runHandler(
	context: RouteContext,
	handler: RouteHandler,
): Promise<Result<void, unknown>> {
	return promiseResult(async () => {
		await handler(context)
		if (
			!context[Context__hasValue]
		) {
			throw new ExitWithoutResponse()
		}
	})
}

// export function useHandler(
// 	handler: RouteHandler,
// 	request: Request,
// 	params: Params,
// 	data: Data,
// ) {
// 	const context = new RouteContext(
// 		request,
// 		params,
// 		data,
// 	)
// 	queueMicrotask(async () => {
// 		try {
// 			await handler(context)
// 			if (
// 				context[Context__status] === Status.Pending
// 			) {
// 				return context.err(new ExitWithoutResponse())
// 			}
// 		} catch (e) {
// 			context.err(e)
// 		}
// 	})
// 	return context
// }

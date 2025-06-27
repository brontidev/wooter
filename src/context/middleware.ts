import type { Data, MiddlewareHandler, Params } from "@/export/types.ts"
import {
	Context__chain,
	Context__hasValue,
	Context__resolve,
	RouteContext,
} from "@/context/index.ts"
import {
	MiddlewareCalledUpTooManyTimes,
	MiddlewareDidntCallUp,
} from "@/export/error.ts"
import type { Result } from "@oxi/result"
import type { Up } from "../graph/router.ts"
import { createResolvers, type Resolvers } from "../promise.ts"

/**
 * Context class passed into middleware handlers
 */
export class MiddlewareContext<
	TParams extends Params = Params,
	TData extends Data = Data,
	TNextData extends Data | undefined = Data,
> extends RouteContext<TParams, TData> {
	private hasCalledUp = false
	private _storedResponse: Response | undefined
	private readonly resolvers: Resolvers<Result<void, unknown>> = createResolvers();

	/**
	 * Stored response from the next handler
	 */
	get storedResponse(): Response | undefined {
		return this._storedResponse
	}

	[Context__chain](context: RouteContext) {
		context[Context__resolve]((result) => {
			this.value = result
		})
	}

	/**
	 * Creates a new Middleware Context
	 * @param request Request
	 * @param params Parameters
	 * @param data Wooter Data
	 * @param up Next Function
	 */
	constructor(
		override readonly request: Request,
		override readonly params: TParams,
		override readonly data: TData,
		private readonly internal_up: Up<TNextData>,
	) {
		super(request, params, data)
	}

	/**
	 * Evaluates the next handler
	 * @param data Added data
	 * @param request New Request
	 * @returns Repsonse from the handler
	 */
	private _up = (
		data: TNextData,
		request?: Request,
	): Promise<Result<Response, unknown>> => {
		if (this.hasCalledUp) {
			throw new MiddlewareCalledUpTooManyTimes()
		}
		this.hasCalledUp = true
		const [context, promise] = this.internal_up(
			data ?? {},
			(request ?? this.request).clone(),
		)
		promise.then(this.resolvers.resolve)
		return new Promise((res) => {
			context[Context__resolve](res)
		})
	}

	get up() {
		return this._up as TNextData extends undefined
			? () => Promise<Result<Response, unknown>>
			: (
				data: TNextData,
				request?: Request,
			) => Promise<Result<Response, unknown>>
	}

	get block() {
	    return this.resolvers.promise;
	}
}

export async function runMiddleware(
    context: MiddlewareContext,
    middlewareHandler: MiddlewareHandler,
) {
	await middlewareHandler(context)
	if (!context[Context__hasValue]) {
		if (!context.storedResponse) {
			return context.err(
				new MiddlewareDidntCallUp(),
			)
		}
		context.resp(context.storedResponse)
	}
}

// export function useMiddleware(
// 	middlewareHandler: MiddlewareHandler,
// 	request: Request,
// 	params: Params,
// 	data: Data,
// 	next: (
// 		data: Data,
// 		request: Request,
// 	) => RouteContext,
// ) {
// 	const context = new MiddlewareContext(
// 		request,
// 		params,
// 		data,
// 		next,
// 	)

// 	queueMicrotask(async () => {
// 		try {
// 			await middlewareHandler(context)
// 			if (context[Context__status] === Status.Pending) {
// 				if (!context.storedResponse) {
// 					return context.err(
// 						new MiddlewareDidntCallUp(),
// 					)
// 				}
// 				context.resp(context.storedResponse)
// 			}
// 		} catch (e) {
// 			context.err(e)
// 		}
// 	})
// 	return context
// }

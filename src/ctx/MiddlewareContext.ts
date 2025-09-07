import type { Option } from "@oxi/option"
import type { Data, Params } from "../export/types.ts"
import RouteContext, {
	HandlerDidntRespondERR,
	type InternalHandler,
	RouteContext__block,
	RouteContext__respond,
} from "./RouteContext.ts"
import type { Result } from "@oxi/result"

/**
 * Context class passed into middleware handlers
 */
export default class MiddlewareContext<
	TParams extends Params = Params,
	TData extends Data = Data,
	TNextData extends Data = Data,
> extends RouteContext {
	#nextCtx?: RouteContext

	/**
	 * @internal
	 */
	constructor(
		override readonly request: Request,
		override readonly params: TParams,
		override readonly data: TData,
		private readonly nextHandler: (
			data: TNextData,
			request: Request,
		) => RouteContext,
	) {
		super(request, params, data)
	}

	/**
	 * Runs the next handler
	 * resolves after handler responds
	 * (the handler may still be executing after this resolves)
	 *
	 * @param data - middleware data
	 * @param request - new request object
	 * @returns Response Option
	 */
	readonly next = (
		data?: TNextData,
		request?: Request,
	): Promise<Option<Response>> => {
		const ctx = this.nextHandler(
			data || {} as TNextData,
			request || this.request,
		)
		this.#nextCtx = ctx
		return ctx[RouteContext__respond]
	}

	/**
	 * must be called AFTER .next()
	 * Resolves after the handler is completely finised
	 * assuming the handler has already been started
	 * @returns Result containing nothing, or an error
	 */
	readonly block = (): Promise<Result<null, unknown>> => {
		if (!this.#nextCtx) {
			throw new Error(
				"middleware attempted to await handler resolution before .next()",
			)
		}
		return this.#nextCtx[RouteContext__block]
	}

	/**
	 * @internal
	 */
	static useMiddlewareHandler(
		handler: MiddlewareHandler,
		params: Params,
		next: InternalHandler,
	): InternalHandler {
		return (data, req) => {
    		console.log(handler)
			const ctx = new MiddlewareContext(req, data, params, next)
			handler(ctx).then(() => {
				if (ctx.respondChannel.resolved) {
					ctx.ok()
				} else {
					ctx.err(new HandlerDidntRespondERR())
				}
			}, (err) => {
				ctx.err(err)
			})
			return ctx
		}
	}

	///
	/// EXTRA FUNCTIONS
	///

	/**
	 * Runs handler & sends response, if it is not empty
	 *
	 * shorthand for `(await ctx.next(data, request)).map(r => ctx.resp(r))`
	 * @param data - middleware data
	 * @param request - new request object
	 * @returns Response option
	 */
	readonly pass = async (
		data?: TNextData,
		request?: Request,
	): Promise<Option<Response>> =>
		(await this.next(data, request)).map((r) => this.resp(r))

	/**
	 * Runs handler, waits for response and re-throws any errors
	 *
	 * shorthand for `(await ctx.next(data, request)).unwrapOrElse(async () => { throw (await ctx.block()).unwrapErr() }) `
	 * @param data - middleware data
	 * @param request - new request object
	 * @returns Response
	 */
	readonly unwrap = async (
		data?: TNextData,
		request?: Request,
	): Promise<Response> => {
		return (await this.next(data, request)).unwrapOrElse(
			// @ts-ignore: This case should always throw anyway
			async () => {
				throw (await this.block()).unwrapErr()
			},
		)
	}

	/**
	 * Runs handler, waits for response, sends it and re-throws any errors
	 *
	 * shorthand for `(await ctx.pass(data, request)).unwrapOrElse(async () => { throw (await ctx.block()).unwrapErr() }) `
	 * @param data - middleware data
	 * @param request - new request object
	 * @returns Response
	 */
	readonly unwrapAndRespond = async (data?: TNextData): Promise<Response> => {
		return (await this.pass(data)).unwrapOrElse(
			// @ts-ignore: This case should always error out anyway
			async () => {
				throw (await this.block()).unwrapErr()
			},
		)
	}
}
/**
 * Middlware handler
 *
 * @param ctx - Middleware context
 */
export type MiddlewareHandler<
	TParams extends Params = Params,
	TData extends Data = Data,
	TNextData extends Data = Data,
> = (ctx: MiddlewareContext<TParams, TData, TNextData>) => Promise<unknown>

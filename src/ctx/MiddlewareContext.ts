import type { Option } from "@@/option.ts"
import type { Data, Params } from "@@/types.ts"
import RouteContext, {
	HandlerDidntRespondError,
	type InternalHandler,
	RouteContext__block,
	RouteContext__respond,
} from "./RouteContext.ts"
import type { Result } from "@@/result.ts"
import WooterError from "@/WooterError.ts"
import type { TEmptyObject } from "@@/chemin.ts"

/**
 * The middleware handler must call ctx.next() before exiting
 */
export class MiddlewareHandlerDidntCallUpError extends WooterError {
	/** name */
	override name: string = "MiddlewareHandlerDidntCallUpError"

	constructor() {
		super("The middleware handler must call ctx.next() before exiting")
	}
}

/**
 * The middleware handler must call ctx.next() before being able to call ctx.block()
 */
export class MiddlewareCalledBlockBeforeNextError extends WooterError {
	/** name */
	override name: string = "MiddlewareCalledBlockBeforeNextError"

	constructor() {
		super("The middleware handler must call ctx.next() before being able to call ctx.block()")
	}
}

/**
 * Context class passed into middleware handlers
 */
export default class MiddlewareContext<
	TParams extends Params | undefined = undefined,
	TData extends Data | undefined = undefined,
	TNextData extends Data | undefined = undefined,
> extends RouteContext<TParams, TData> {
	#nextCtx?: RouteContext
	#blockCalled: boolean = false

	/**
	 * @internal
	 */
	constructor(
		override readonly request: Request,
		data: TData extends undefined ? TEmptyObject : TData,
		params: TParams extends undefined ? TEmptyObject : TParams,
		private readonly nextHandler: InternalHandler,
	) {
		super(request, data, params)
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
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Option<Response>> => {
		const ctx = this.nextHandler(
			data,
			request || this.request,
		)
		this.#nextCtx = ctx
		return ctx[RouteContext__respond].promise
	}

	/**
	 * must be called AFTER .next()
	 * Resolves after the handler is completely finished
	 * assuming the handler has already been started
	 * @returns Result containing nothing, or an error
	 */
	readonly block = async (): Promise<Result<null, unknown>> => {
		if (!this.#nextCtx) {
			throw new MiddlewareCalledBlockBeforeNextError()
		}
		this.#blockCalled = true
		return await this.#nextCtx[RouteContext__block].promise
	}

	/**
	 * @internal
	 */
	static useMiddlewareHandler<
		TParams extends Params = Params,
		TData extends Data | undefined = undefined,
		TNextData extends Data | undefined = undefined,
	>(
		handler: MiddlewareHandler<TParams, TData, TNextData>,
		params: Params,
		next: InternalHandler,
	): InternalHandler {
		return (data, req) => {
			// @ts-expect-error: InternalHandler ignores generics
			const ctx = new MiddlewareContext<TParams, TData, TNextData>(req, data, params, next)
			const run = async () => {
				try {
					await Promise.try(handler, ctx)
					if (ctx.blockChannel.resolved) return
					if (!ctx.#nextCtx) return ctx.err(new MiddlewareHandlerDidntCallUpError())
					if (!ctx.#blockCalled) {
						return await ctx.#nextCtx[RouteContext__block].promise.then((r) => ctx.blockChannel.push(r))
					}
					if (!ctx.respondChannel.resolved) return ctx.err(new HandlerDidntRespondError())
					ctx.ok()
				} catch (e) {
					ctx.err(e)
				}
			}

			run()
			return ctx as unknown as MiddlewareContext
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
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Option<Response>> => (await this.next(data, request)).map((r) => this.resp(r))

	/**
	 * Runs handler, waits for response and re-throws any errors
	 *
	 * shorthand for `(await ctx.next(data, request)).unwrapOrElse(async () => { throw (await ctx.block()).unwrapErr() }) `
	 * @param data - middleware data
	 * @param request - new request object
	 * @returns Response
	 */
	readonly unwrap = async (
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Response> => {
		return (await this.next(data, request)).unwrapOrElse(
			// @ts-expect-error: This case should always throw anyway
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
	 * @returns Response
	 */
	readonly unwrapAndRespond = async (data: TNextData extends undefined ? TEmptyObject : TNextData): Promise<Response> => {
		return (await this.pass(data)).unwrapOrElse(
			// @ts-expect-error: This case should always throw anyway
			async () => {
				throw (await this.block()).unwrapErr()
			},
		)
	}
}
/**
 * Middleware handler
 *
 * @param ctx - Middleware context
 */
export type MiddlewareHandler<
	TParams extends Params = Params,
	TData extends Data | undefined = undefined,
	TNextData extends Data | undefined = undefined,
> = (ctx: MiddlewareContext<TParams, TData, TNextData>) => Promise<unknown> | unknown

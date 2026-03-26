import type { Data, Params } from "@@/types.ts"
import RouteContext, {
	HandlerDidntRespondError,
	type InternalHandler,
	RouteContext__execution,
	RouteContext__respond,
} from "@/ctx/RouteContext.ts"
import WooterError from "@/WooterError.ts"
import type { TEmptyObject } from "@@/chemin.ts"
import { err, ok, type Result } from "@@/result.ts"

/**
 * Error thrown when middleware exits without delegating to `next()`.
 */
export class MiddlewareHandlerDidntCallUpError extends WooterError {
	/** Error name used for identification. */
	override name: string = "MiddlewareHandlerDidntCallUpError"

	constructor() {
		super("The middleware handler must call ctx.next() before exiting")
	}
}

/**
 * Middleware context passed to middleware handlers.
 *
 * Extends {@link RouteContext} with flow-control helpers for composing middleware chains.
 *
 * @typeParam TParams Route param shape.
 * @typeParam TData Data currently available on the context.
 * @typeParam TNextData Data shape that this middleware can pass to the next handler.
 */
export default class MiddlewareContext<
	TParams extends Params | undefined = undefined,
	TData extends Data | undefined = undefined,
	TNextData extends Data | undefined = undefined,
> extends RouteContext<TParams, TData> {
	/**
	 * @internal
	 * Internal marker that tracks whether `next()` or `tryNext()` has been called.
	 */
	private calledNext = false

	/**
	 * @internal
	 * Creates a middleware context instance.
	 *
	 * @param request Current request.
	 * @param data Context data.
	 * @param params Route params.
	 * @param nextHandler Internal continuation handler.
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
	 * Invokes the next handler in the middleware chain.
	 *
	 * @param data Data to merge into downstream context.
	 * @param request Optional request override.
	 * @returns The downstream response, or throws the downstream error.
	 */
	readonly next = async (
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Response> => {
		const opt = await this.tryNext(data, request)
		return opt.match((c) => {
			return c
		}, (e) => {
			throw e
		})
	}

	/**
	 * Like {@link next}, but captures failures in a `Result`.
	 *
	 * @param data Data to merge into downstream context.
	 * @param request Optional request override.
	 * @returns `ok(response)` on success or `err(error)` on failure.
	 */
	readonly tryNext = (
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Result<Response, unknown>> => {
		const { promise, resolve } = Promise.withResolvers<Result<Response, unknown>>()
		this.calledNext = true
		const ctx = this.nextHandler(data, request || this.request)
		ctx[RouteContext__respond].then((response) => {
			resolve(ok(response))
		})
		ctx[RouteContext__execution].then((v) => {
			v.inspect((e) => {
				resolve(err(e))
			})
		})
		return promise
	}

	/**
	 * Invokes {@link next} and immediately responds with the downstream response.
	 *
	 * @param data Data to merge into downstream context.
	 * @param request Optional request override.
	 * @returns The response sent by `resp`.
	 */
	readonly forward = (data: TNextData extends undefined ? TEmptyObject : TNextData, request?: Request): Promise<Response> =>
		this.next(data, request).then(this.resp)

	/**
	 * Invokes {@link tryNext} and maps successful responses through `resp`.
	 *
	 * @param data Data to merge into downstream context.
	 * @param request Optional request override.
	 * @returns Result containing the response or captured error.
	 */
	readonly tryForward = (
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Result<Response, unknown>> => this.tryNext(data, request).then((o) => o.map(this.resp))

	/**
	 * Adapts a middleware handler into the router's internal handler signature.
	 *
	 * @param handler User middleware handler.
	 * @param params Route params for the current match.
	 * @param next Continuation for the next link in the chain.
	 * @returns Internal handler that executes middleware and reports lifecycle errors.
	 *
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

			Promise.try(handler, ctx)
				.then(() => {
					if (!ctx.respondSoon.resolved) {
						if (!ctx.calledNext) return ctx.catchErr(new MiddlewareHandlerDidntCallUpError())
						return ctx.catchErr(new HandlerDidntRespondError())
					}
					ctx.ok()
				}, (e) => {
					ctx.catchErr(e)
				})

			return ctx as unknown as MiddlewareContext
		}
	}
}
/**
 * Middleware handler function.
 *
 * @param ctx Middleware context.
 * @returns Optional promise for async middleware.
 */
export type MiddlewareHandler<
	TParams extends Params = Params,
	TData extends Data | undefined = undefined,
	TNextData extends Data | undefined = undefined,
> = (ctx: MiddlewareContext<TParams, TData, TNextData>) => Promise<unknown> | unknown

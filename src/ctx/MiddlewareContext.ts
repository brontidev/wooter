import type { Params, State as State } from "@@/types.ts"
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
 * @typeParam TState State currently available on the context.
 * @typeParam TNextState State shape that this middleware can pass to the next handler.
 */
export default class MiddlewareContext<
	TParams extends Params | undefined = undefined,
	TState extends State | undefined = undefined,
	TNextState extends State | undefined = undefined,
> extends RouteContext<TParams, TState> {
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
	 * @param state Context state.
	 * @param params Route params.
	 * @param nextHandler Internal continuation handler.
	 */
	constructor(
		override readonly request: Request,
		state: TState extends undefined ? TEmptyObject : TState,
		params: TParams extends undefined ? TEmptyObject : TParams,
		private readonly nextHandler: InternalHandler,
	) {
		super(request, state, params)
	}

	/**
	 * Invokes the next handler in the middleware chain.
	 *
	 * @param state State to merge into downstream context.
	 * @param request Optional request override.
	 * @returns The downstream response, or throws the downstream error.
	 */
	readonly next = async (
		state: TNextState extends undefined ? TEmptyObject : TNextState,
		request?: Request,
	): Promise<Response> => {
		const opt = await this.tryNext(state, request)
		return opt.match((c) => {
			return c
		}, (e) => {
			throw e
		})
	}

	/**
	 * Like {@link next}, but captures failures in a `Result`.
	 *
	 * @param state State to merge into downstream context.
	 * @param request Optional request override.
	 * @returns `ok(response)` on success or `err(error)` on failure.
	 */
	readonly tryNext = (
		state: TNextState extends undefined ? TEmptyObject : TNextState,
		request?: Request,
	): Promise<Result<Response, unknown>> => {
		const { promise, resolve } = Promise.withResolvers<Result<Response, unknown>>()
		this.calledNext = true
		const ctx = this.nextHandler(state, request || this.request)
		this[RouteContext__respond].then((response) => {
			if (!ctx[RouteContext__respond].resolved) {
				ctx[RouteContext__respond].push(response)
			}
		})
		ctx[RouteContext__respond].then((response) => {
			resolve(ok(response))
		})
		ctx[RouteContext__execution].then((v) => {
			v.inspect((e) => {
				if (e instanceof HandlerDidntRespondError && this.respondSoon.resolved) {
					this[RouteContext__respond].then((response) => {
						resolve(ok(response))
					})
					return
				}
				resolve(err(e))
			})
		})
		return promise
	}

	/**
	 * Invokes {@link next} and immediately responds with the downstream response.
	 *
	 * @param state State to merge into downstream context.
	 * @param request Optional request override.
	 * @returns The response sent by `resp`.
	 */
	readonly forward = (state: TNextState extends undefined ? TEmptyObject : TNextState, request?: Request): Promise<Response> =>
		this.next(state, request).then((response) => this.respondSoon.resolved ? response : this.resp(response))

	/**
	 * Invokes {@link tryNext} and maps successful responses through `resp`.
	 *
	 * @param state State to merge into downstream context.
	 * @param request Optional request override.
	 * @returns Result containing the response or captured error.
	 */
	readonly tryForward = (
		state: TNextState extends undefined ? TEmptyObject : TNextState,
		request?: Request,
	): Promise<Result<Response, unknown>> =>
		this.tryNext(state, request).then((o) => o.map((response) => this.respondSoon.resolved ? response : this.resp(response)))

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
		TState extends State | undefined = undefined,
		TNextState extends State | undefined = undefined,
	>(
		handler: MiddlewareHandler<TParams, TState, TNextState>,
		params: Params,
		next: InternalHandler,
	): InternalHandler {
		return (state, req) => {
			const ctx = new MiddlewareContext<TParams, TState, TNextState>(
				req,
				state as TState extends undefined ? TEmptyObject : TState,
				params as TParams extends undefined ? TEmptyObject : TParams,
				next,
			)

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
	TState extends State | undefined = undefined,
	TNextState extends State | undefined = undefined,
> = (ctx: MiddlewareContext<TParams, TState, TNextState>) => Promise<unknown> | unknown

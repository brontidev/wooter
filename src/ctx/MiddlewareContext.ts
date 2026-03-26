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
 * Context class passed into middleware handlers
 */
export default class MiddlewareContext<
	TParams extends Params | undefined = undefined,
	TData extends Data | undefined = undefined,
	TNextData extends Data | undefined = undefined,
> extends RouteContext<TParams, TData> {
	private calledNext = false

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
	 * Makes a call to the next handler in the chain, returning a promise that resolves to either the Response or rejects with any error the handler throws
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
	 * @see MiddlewareContext.next
	 *
	 * calls .next & maps to a result
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

	readonly forward = (data: TNextData extends undefined ? TEmptyObject : TNextData, request?: Request): Promise<Response> =>
		this.next(data, request).then(this.resp)

	readonly tryForward = (
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Result<Response, unknown>> => this.tryNext(data, request).then((o) => o.map(this.resp))

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
 * Middleware handler
 *
 * @param ctx - Middleware context
 */
export type MiddlewareHandler<
	TParams extends Params = Params,
	TData extends Data | undefined = undefined,
	TNextData extends Data | undefined = undefined,
> = (ctx: MiddlewareContext<TParams, TData, TNextData>) => Promise<unknown> | unknown

import type { Option } from "@@/option.ts"
import type { Data, Params } from "@@/types.ts"
import RouteContext, {
	HandlerDidntRespondError,
	type InternalHandler,
	RouteContext__execution,
	RouteContext__respond,
} from "./RouteContext.ts"
import type { Result } from "@@/result.ts"
import { ok } from "@@/result.ts"
import WooterError from "@/WooterError.ts"
import type { TEmptyObject } from "@@/chemin.ts"
import { Soon } from "@bronti/robust/Soon"
import { ControlFlowBreak } from "@/ControlFlowBreak.ts"

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
 * The middleware handler must call ctx.next() before being able to call ctx.wait()
 */
export class MiddlewareCalledWaitBeforeNextError extends WooterError {
	/** name */
	override name: string = "MiddlewareCalledWaitBeforeNextError"

	constructor() {
		super("The middleware handler must call ctx.next() before being able to call ctx.wait()")
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
	 * Waits until the handler is done executing
	 * @returns Result containing nothing, or an error
	 */
	readonly wait = async (): Promise<Result<null, unknown>> => {
		if (!this.#nextCtx) {
			throw new MiddlewareCalledWaitBeforeNextError()
		}
		this.#blockCalled = true
		return await this.#nextCtx[RouteContext__execution].promise
	}

	/**
	 * @internal
	 * Override catchErr to handle control-flow breaks after resp()
	 */
	protected override catchErr = (e: unknown): void => {
		// If execution is already resolved, we can only log the error
		// (this follows the parent's behavior - errors after resolution are not propagated)
		if (this.executeSoon.resolved) {
			console.error(e)
			return
		}
		// If the error is ControlFlowBreak and a response was already sent,
		// treat it as success (this is intentional control flow, not an error)
		if (e === ControlFlowBreak && this.respondSoon.resolved) {
			this.executeSoon.push(ok(null))
			return
		}
		// Normal error handling
		this.err(e)
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
			// const run = async () => {
			// 	try {
			// 		await Promise.try(handler, ctx)
			// 		if (ctx.executeSoon.resolved) return
			// 		if (!ctx.#nextCtx) return ctx.err(new MiddlewareHandlerDidntCallUpError())
			// 		if (!ctx.#blockCalled) {
			// 			return await ctx.#nextCtx[RouteContext__execution].map((r) => ctx.executeSoon.push(r))
			// 		}
			// 		if (!ctx.respondSoon.resolved) return ctx.err(new HandlerDidntRespondError())
			// 		ctx.ok()
			// 	} catch (err) {
			// 		if (ctx.executeSoon.resolved) return console.error(err)
			// 		ctx.err(err)
			// 	}
			// }
			//
			// run()

			const run = Soon.tryable<void, unknown>(async (_) => {
				await handler(ctx)
				if (ctx.executeSoon.resolved) return
				if (!ctx.#nextCtx) throw new MiddlewareHandlerDidntCallUpError()
				if (!ctx.#blockCalled) {
					return ctx.#nextCtx[RouteContext__execution].map((r) => ctx.executeSoon.push(r))
				}
				if (!ctx.respondSoon.resolved) throw new HandlerDidntRespondError()
			}, ctx.catchErr)

			run().then((r) => r.match(ctx.ok, ctx.catchErr))

			return ctx as unknown as MiddlewareContext
		}
	}

	///
	/// EXTRA FUNCTIONS
	///

	/**
	 * Runs the next handler, and sends the response once it's done
	 *
	 * shorthand for `(await ctx.next(data, request)).map(r => ctx.resp(r))`
	 * @param data - middleware data
	 * @param request - new request object
	 * @returns Response option
	 */
	readonly relay = async (
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Option<Response>> => (await this.next(data, request)).map((r) => this.resp(r))

	/**
	 * Runs handler, waits for response and re-throws any errors
	 *
	 * shorthand for `(await ctx.next(data, request)).unwrapOrElse(async () => { throw (await ctx.wait()).unwrapErr() }) `
	 * @param data - middleware data
	 * @param request - new request object
	 * @returns Response
	 */
	readonly expectResponse = async (
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Response> => {
		const res = await this.next(data, request)
		if (res.isSome()) {
			return res.unwrap()
		} else {
			throw (await this.wait()).unwrapErr()
		}
	}

	/**
	 * Runs handler, waits for response, sends it and re-throws any errors
	 *
	 * shorthand for `(await ctx.pass(data, request)).unwrapOrElse(async () => { throw (await ctx.wait()).unwrapErr() }) `
	 * @param data - middleware data
	 * @param request - new request object
	 * @returns Response
	 */
	readonly expectAndRespond = async (
		data: TNextData extends undefined ? TEmptyObject : TNextData,
		request?: Request,
	): Promise<Response> => {
		const res = await this.relay(data, request)
		if (res.isSome()) {
			return res.unwrap()
		} else {
			throw (await this.wait()).unwrapErr()
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

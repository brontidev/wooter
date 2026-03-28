import { none, type Option, some } from "@@/option.ts"
import { Soon } from "@bronti/robust/Soon"
import type { Data, Params } from "@@/types.ts"
import WooterError, { catchStrayError, ControlFlowBreak } from "@/WooterError.ts"
import { TypedMap } from "@bronti/robust/TypedMap"
import type { TEmptyObject } from "@@/chemin.ts"

/**
 * Error thrown when a handler exits without calling `resp()`.
 */
export class HandlerDidntRespondError extends WooterError {
	/** Error name used for identification. */
	override name: string = "HandlerDidntRespondError"

	constructor() {
		super("The handler must respond before exiting")
	}
}

/**
 * Error thrown when a handler attempts to respond more than once.
 */
export class HandlerRespondedTwiceError extends WooterError {
	/** Error name used for identification. */
	override name: string = "HandlerRespondedTwiceError"

	constructor() {
		super("The handler called resp() multiple times")
	}
}

type Resp = {
	(response: Response): Response
	(body?: BodyInit | null, init?: ResponseInit): Response
	json: typeof Response.json
}

/**
 * Internal symbol for reading a context's execution state.
 */
export const RouteContext__execution = Symbol("RouteContext__execution")

/**
 * Internal symbol for reading a context's response state.
 */
export const RouteContext__respond = Symbol("RouteContext__respond")
/**
 * Context passed to route handlers.
 *
 * @typeParam TParams Route param shape.
 * @typeParam TData Data shape accumulated from middleware.
 */
export default class RouteContext<
	TParams extends Params | undefined = undefined,
	TData extends Data | undefined = undefined,
> {
	/**
	 * Backing store for context data.
	 */
	private readonly _data: TData extends undefined ? TEmptyObject : TData

	/**
	 * Backing store for route params.
	 */
	private readonly _params: TypedMap<TParams extends undefined ? TEmptyObject : TParams>

	/**
	 * Middleware data available to the current handler.
	 *
	 * @returns The typed context data object.
	 */
	get data(): TData extends undefined ? TEmptyObject : TData {
		return this._data
	}

	/**
	 * Route params captured from path matching.
	 *
	 * @returns Typed map of route params.
	 */
	get params(): TypedMap<TParams extends undefined ? TEmptyObject : TParams> {
		return this._params
	}

	/**
	 * Tracks handler completion state.
	 *
	 * `none()` means successful completion, `some(error)` means failure.
	 *
	 * @internal
	 */
	protected executionSoon: Soon<Option<unknown>> = new Soon()

	/**
	 * Tracks the first response emitted by this context.
	 *
	 * @internal
	 */
	protected respondSoon: Soon<Response> = new Soon()

	/**
	 * Exposes {@link executionSoon} through a symbol-based internal API.
	 *
	 * @internal
	 */
	get [RouteContext__execution](): RouteContext["executionSoon"] {
		return this.executionSoon
	}

	/**
	 * Exposes {@link respondSoon} through a symbol-based internal API.
	 *
	 * @internal
	 */
	get [RouteContext__respond](): RouteContext["respondSoon"] {
		return this.respondSoon
	}

	/**
	 * Parsed request URL.
	 */
	readonly url: URL

	/**
	 * Creates a route context.
	 *
	 * @param request Incoming request.
	 * @param data Context data from middleware.
	 * @param params Route params captured by path matching.
	 *
	 * @internal
	 */
	constructor(
		/** Request object. */
		readonly request: Request,
		data: TData extends undefined ? TEmptyObject : TData,
		params: TParams extends undefined ? TEmptyObject : TParams,
	) {
		this.url = new URL(request.url)
		this._data = data
		this._params = new TypedMap(params)
	}

	/**
	 * Marks execution as failed with an error.
	 *
	 * @param e Error value.
	 *
	 * @internal
	 */
	protected err(e: unknown) {
		this.executionSoon.push(some(e))
	}

	/**
	 * Marks the handler as successfully completed.
	 *
	 * This is typically called by the internal runtime after handler execution settles.
	 *
	 * @returns `void`.
	 */
	readonly ok = (): void => {
		if (!this.respondSoon.resolved) return this.err(new HandlerDidntRespondError())
		this.executionSoon.push(none())
	}

	/**
	 * @internal
	 */
	private static createResp<R extends Params | undefined, D extends Data | undefined>(self: RouteContext<R, D>): Resp {
		const resp: Resp = (responseOrBody, init?: ResponseInit): Response => {
			const response = responseOrBody instanceof Response ? responseOrBody : new Response(responseOrBody, init)
			if (self.executionSoon.resolved) {
				console.warn("responding after execution is misuse of the library")
				return response
			}
			if (self.respondSoon.resolved) {
				throw new HandlerRespondedTwiceError()
			}

			self.respondSoon.push(response)
			return response
		}

		resp.json = (data, init) => resp(Response.json(data, init))
		return resp
	}

	/**
	 * Responds to the request.
	 *
	 * @param response A fully constructed response.
	 * @param init Optional response init when the first argument is body-like.
	 * @returns The response that was sent.
	 * @throws HandlerRespondedTwiceError If called after a previous response.
	 */
	readonly resp: {
		(response: Response): Response
		(body?: BodyInit | null, init?: ResponseInit): Response
		json: typeof Response.json
	} = RouteContext.createResp(this)

	/**
	 * Safely exits handler execution without surfacing a framework error.
	 *
	 * Call this when you intentionally stop processing after sending a response.
	 *
	 * @throws ControlFlowBreak Always throws to abort current control flow.
	 */
	readonly safeExit = (): never => {
		throw ControlFlowBreak
	}

	/**
	 * Captures an internal handler error and routes it to the appropriate sink.
	 *
	 * @param e Error value.
	 *
	 * @internal
	 */
	protected catchErr = (e: unknown): void => {
		if (this.respondSoon.resolved) {
			if(e != ControlFlowBreak) catchStrayError(e)
			return this.ok()
		}

		this.err(e)
	}

	/**
	 * Adapts a user route handler into the internal runtime handler signature.
	 *
	 * @param handler Route handler to wrap.
	 * @param params Route params for the current match.
	 * @returns Internal handler that manages lifecycle success/error state.
	 *
	 * @internal
	 */
	static useRouteHandler<TParams extends Params | undefined = Params, TData extends Data | undefined = Data>(
		handler: RouteHandler<TParams, TData>,
		params: Params,
	): InternalHandler {
		return (data, req) => {
			// @ts-expect-error: InternalHandler ignores generics
			const ctx = new RouteContext<TParams, TData>(req, data, params)

			Promise.try(handler, ctx)
				.then(() => {
					ctx.ok()
				}, (e) => {
					ctx.catchErr(e)
				})

			return ctx as unknown as RouteContext
		}
	}
}

/**
 * Internal route handler signature used by the execution pipeline.
 */
export type InternalHandler = (
	data: Data,
	request: Request,
) => RouteContext

/**
 * Route handler function.
 *
 * @param ctx Route context.
 * @returns Optional promise for async handlers.
 */
export type RouteHandler<
	TParams extends Params | undefined = Params,
	TData extends Data | undefined = Data,
> = (ctx: RouteContext<TParams, TData>) => Promise<unknown> | unknown

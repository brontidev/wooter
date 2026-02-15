import { err, ok, type Result } from "@@/result.ts"
import { none, type Option, some } from "@@/option.ts"
import { Soon } from "@bronti/robust/Soon"
import type { Data, Params } from "@@/types.ts"
import WooterError from "@/WooterError.ts"
import { TypedMap } from "@bronti/robust/TypedMap"
import type { TEmptyObject } from "@@/chemin.ts"

/**
 * The handler must respond before exiting
 */
export class HandlerDidntRespondError extends WooterError {
	/** name */
	override name: string = "HandlerDidntRespondError"

	constructor() {
		super("The handler must respond before exiting")
	}
}

/**
 * The handler called resp() multiple times
 */
export class HandlerRespondedTwiceError extends WooterError {
	/** name */
	override name: string = "HandlerRespondedTwiceError"

	constructor() {
		super("The handler called resp() multiple times")
	}
}

export const RouteContext__execution = Symbol("RouteContext__execution")
export const RouteContext__respond = Symbol("RouteContext__respond")
/**
 * Context class passed into route handlers
 */
export default class RouteContext<
	TParams extends Params | undefined = undefined,
	TData extends Data | undefined = undefined,
> {
	private readonly _data: TData extends undefined ? TEmptyObject : TData
	private readonly _params: TypedMap<TParams extends undefined ? TEmptyObject : TParams>

	/**
	 * Middleware data
	 */
	get data(): TData extends undefined ? TEmptyObject : TData {
		return this._data
	}

	/**
	 * Route parameters
	 */
	get params(): TypedMap<TParams extends undefined ? TEmptyObject : TParams> {
		return this._params
	}

	/**
	 * @internal
	 */
	protected executeSoon: Soon<Result<null, unknown>> = new Soon()
	/**
	 * @internal
	 */
	protected respondSoon: Soon<Option<Response>> = new Soon()

	/**
	 * @internal
	 */
	get [RouteContext__execution](): RouteContext["executeSoon"] {
		return this.executeSoon
	}

	/**
	 * @internal
	 */
	get [RouteContext__respond](): RouteContext["respondSoon"] {
		return this.respondSoon
	}

	/**
	 * Request URL
	 */
	readonly url: URL

	/**
	 * @internal
	 */
	constructor(
		/**
		 * Request object
		 */
		readonly request: Request,
		data: TData extends undefined ? TEmptyObject : TData,
		params: TParams extends undefined ? TEmptyObject : TParams,
	) {
		this.url = new URL(request.url)
		this._data = data
		this._params = new TypedMap(params)
	}

	/**
	 * @internal
	 */
	protected err(e: unknown) {
		this.respondSoon.push(none())
		this.executeSoon.push(err(e))
	}

	/**
	 * [advanced]
	 *
	 * Ends the handler (stops error catching)
	 * This is the equivalent of resolving the handler promise
	 */
	readonly ok = (): void => {
		this.executeSoon.push(ok(null))
	}

	/**
	 * Responds to the request
	 * @returns Response
	 */
	readonly resp: {
		(response: Response): Response
		(body?: BodyInit | null, init?: ResponseInit): Response
	} = (responseOrBody: Response | BodyInit | null | undefined, init?: ResponseInit): Response => {
		if (this.respondSoon.resolved) {
			throw new HandlerRespondedTwiceError()
		}

		const response = responseOrBody instanceof Response ? responseOrBody : new Response(responseOrBody, init)

		this.respondSoon.push(some(response))
		return response
	}

	/**
	 * @internal
	 * Used for useRouteHandler & useMiddlewareHandler to handle any errors that happen within the handler
	 * @param e error
	 */
	protected catchErr = (e: unknown): void => {
		if (this.executeSoon.resolved) {
			console.error(e)
			return
		}
		this.err(e)
	}

	/**
	 * @internal
	 */
	static useRouteHandler<TParams extends Params | undefined = Params, TData extends Data | undefined = Data>(
		handler: RouteHandler<TParams, TData>,
		params: Params,
	): InternalHandler {
		return (data, req) => {
			// @ts-expect-error: InternalHandler ignores generics
			const ctx = new RouteContext<TParams, TData>(req, data, params)

			const run = Soon.tryable<void, unknown>(async (_) => {
				await handler(ctx)
				if (ctx.executeSoon.resolved) return
				if (!ctx.respondSoon.resolved) throw new HandlerDidntRespondError()
			}, ctx.catchErr)

			run().then((r) => r.match(ctx.ok, ctx.catchErr))

			return ctx as unknown as RouteContext
		}
	}
}

export type InternalHandler = (
	data: Data,
	request: Request,
) => RouteContext

/**
 * Route handler
 *
 * @param ctx - Route context
 */
export type RouteHandler<
	TParams extends Params | undefined = Params,
	TData extends Data | undefined = Data,
> = (ctx: RouteContext<TParams, TData>) => Promise<unknown> | unknown

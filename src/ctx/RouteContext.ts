import { Err, Ok, type Result } from "@@/result.ts"
import { None, type Option, Some } from "@@/option.ts"
import type { Data, Params } from "@@/types.ts"
import { Channel } from "@/ctx/Channel.ts"
import WooterError from "@/WooterError.ts"
import TypedMap from "@/TypedMap.ts"
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

export const RouteContext__block = Symbol("RouteContext__block")
export const RouteContext__respond = Symbol("RouteContext__respond")
/**
 * Context class passed into route handlers
 */
export default class RouteContext<
	TParams extends Params | undefined = undefined,
	TData extends Data | undefined = undefined,
> {
	private readonly _data: TypedMap<TData extends undefined ? TEmptyObject : TData>
	private readonly _params: TypedMap<TParams extends undefined ? TEmptyObject : TParams>

	/**
	 * Middleware data
	 */
	get data(): TypedMap<TData extends undefined ? TEmptyObject : TData> {
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
	protected blockChannel: Channel<Result<null, unknown>> = new Channel()
	/**
	 * @internal
	 */
	protected respondChannel: Channel<Option<Response>> = new Channel()

	/**
	 * @internal
	 */
	get [RouteContext__block](): RouteContext["blockChannel"] {
		return this.blockChannel
	}

	/**
	 * @internal
	 */
	get [RouteContext__respond](): RouteContext["respondChannel"] {
		return this.respondChannel
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
		this._data = new TypedMap(data)
		this._params = new TypedMap(params)
	}

	/**
	 * @internal
	 */
	protected err(err: unknown) {
		this.respondChannel.push(None)
		this.blockChannel.push(Err(err))
	}

	/**
	 * [advanced]
	 *
	 * Ends the handler (stops error catching)
	 * This is the equivalent of resolving the handler promise
	 */
	readonly ok = (): void => {
		this.blockChannel.push(Ok(null))
	}

	/**
	 * Responds to the request
	 * @returns Response
	 */
	readonly resp = (response: Response): Response => {
		if (this.respondChannel.resolved) {
			throw new HandlerRespondedTwiceError()
		}
		this.respondChannel.push(Some(response))
		return response
	}

	/**
	 * @internal
	 */
	static useRouteHandler<TParams extends Params | undefined = Params, TData extends Data | undefined = Data>(
		handler: RouteHandler<TParams, TData>,
		params: Params,
	): InternalHandler {
		const nhandler: (...args: Parameters<RouteHandler<TParams, TData>>) => Promise<unknown> = async (ctx) =>
			await handler(ctx)

		return (data, req) => {
			// @ts-expect-error: InternalHandler ignores generics
			const ctx = new RouteContext<TParams, TData>(req, data, params)
			nhandler(ctx).then(() => {
				if (ctx.blockChannel.resolved) return
				if (!ctx.respondChannel.resolved) return ctx.err(new HandlerDidntRespondError())
				ctx.ok()
			}, (err) => {
				ctx.err(err)
			})
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

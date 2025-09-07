import { Err, Ok, type Result } from "@oxi/result"
import { None, type Option, Some } from "@oxi/option"
import type { Data, Params } from "../export/types.ts"
import { Channel } from "./Channel.ts"
import { WooterError } from "../export/error.ts"

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

export const RouteContext__block = Symbol("RouteContext__block")
export const RouteContext__respond = Symbol("RouteContext__respond")

/**
 * Context class passed into route handlers
 */
export default class RouteContext<
	TParams extends Params = Params,
	TData extends Data = Data,
> {
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
		/**
		 * Middleware data
		 */
		readonly data: TData,
		/**
		 * Route parameters
		 */
		readonly params: TParams,
	) {
		this.url = new URL(request.url)
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
			throw ("resp() called multiple times")
		}
		this.respondChannel.push(Some(response))
		return response
	}

	/**
	 * @internal
	 */
	static useRouteHandler(
		handler: RouteHandler,
		params: Params,
	): InternalHandler {
		return (data, req) => {
			const ctx = new RouteContext(req, data, params)
			handler(ctx).then(() => {
				if (ctx.blockChannel.resolved) return
				if (!ctx.respondChannel.resolved) return ctx.err(new HandlerDidntRespondError())
				ctx.ok()
			}, (err) => {
				ctx.err(err)
			})
			return ctx
		}
	}
}

export type InternalHandler = (data: Data, request: Request) => RouteContext

/**
 * Route handler
 *
 * @param ctx - Route context
 */
export type RouteHandler<
	TParams extends Params = Params,
	TData extends Data = Data,
> = (ctx: RouteContext<TParams, TData>) => Promise<unknown>

import { Err, Ok, type Result } from "@oxi/result"
import { None, type Option, Some } from "@oxi/option"
import { type Data, type Params, WooterError } from "../export/types.ts"
import { Channel, ChannelAlreadPushedError } from "./Channel.ts"

export class HandlerDidntRespondERR extends WooterError {
	constructor() {
		super("The handler must respond before exiting.")
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
	get [RouteContext__block](): RouteContext["blockChannel"]["promise"] {
		return this.blockChannel.wait()
	}

	/**
	 * @internal
	 */
	get [RouteContext__respond](): RouteContext["respondChannel"]["promise"] {
		return this.respondChannel.wait()
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
		try {
			this.respondChannel.push(None, true)
		} catch (e) {
			if (e instanceof ChannelAlreadPushedError) {
				console.warn(err)
			}
		}
		this.blockChannel.push(Err(err), false)
	}

	/**
	 * [advanced]
	 *
	 * Ends the handler (stops error catching)
	 * This is the equivalent of resolving the handler promise
	 */
	readonly ok = (): void => {
		this.blockChannel.push(Ok(null), false)
	}

	/**
	 * Responds to the request
	 * @returns Response
	 */
	readonly resp = (response: Response): Response => {
		try {
			this.respondChannel.push(Some(response))
		} catch (e) {
			if (e instanceof ChannelAlreadPushedError) {
				console.warn("resp() called multiple times")
			}
		}
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
			console.log("[useRouteHandler] handler started")
			ctx[RouteContext__respond].then((r) => {
				console.log("[useRouteHandler] handler responded", r.toString())
			})
			handler(ctx).then(() => {
				console.log("[useRouteHandler] handler resolved")
				if (ctx.respondChannel.resolved) {
					console.log(
						"[useRouteHandler] handler has resolved AND responded, sending `ok`",
					)
					ctx.ok()
				} else {
					console.log(
						"[useRouteHandler] handler has resolved but didn't respond",
					)
					ctx.err(new HandlerDidntRespondERR())
				}
			}, (err) => {
				console.log("[useRouteHandler] handler errored", err)
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

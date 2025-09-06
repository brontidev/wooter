import { Err, Ok, Result } from "@oxi/result"
import { None, type Option, Some } from "@oxi/option"
import type { Data, Params } from "../export/types.ts"

export class HandlerDidntRespondERR extends Error {
	constructor() {
		super("The handler must respond before exiting.")
	}
}

export const RouteContext__block = Symbol("RouteContext__block")
export const RouteContext__respond = Symbol("RouteContext__respond")

export class RouteContext<TParams extends Params, TData extends Data> {
	protected block = new Channel<Result<null, unknown>>()
	protected respond = new Channel<Option<Response>>()

	get [RouteContext__block]() {
		return this.block.wait()
	}

	get [RouteContext__respond]() {
		return this.respond.wait()
	}

	readonly url: URL

	constructor(
		readonly request: Request,
		readonly data: TData,
		readonly params: TParams,
	) {
		this.url = new URL(request.url)
	}

	protected err(err: unknown) {
		try {
			this.respond.push(None, true)
		} catch (e) {
			if (e instanceof EventAlreadyPushedError) {
				console.warn(err)
			}
		}
		this.block.push(Err(err), false)
	}

	ok() {
		this.block.push(Ok(null), false)
	}

	resp(response: Response): Response {
		try {
			this.respond.push(Some(response))
		} catch (e) {
			if (e instanceof EventAlreadyPushedError) {
				console.warn("resp() called multiple times")
			}
		}
		return response
	}

	static useRouteHandler(
		handler: RouteHandler,
		params: Params,
	): (data: Data, request: Request) => RouteContext<Params, Data> {
		return (data, req) => {
			const ctx = new RouteContext(req, data, params)
			console.log("[useRouteHandler] handler started")
			ctx[RouteContext__respond].then(r => {
			    console.log("[useRouteHandler] handler responded", r.toString())
			})
			handler(ctx).then(() => {
				console.log("[useRouteHandler] handler resolved")
				if (ctx.respond.resolved) {
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
			return ctx;
		}
	}
}

type RouteHandler<TParams extends Params = Params, TData extends Data = Data> =
	(ctx: RouteContext<TParams, TData>) => Promise<void>

/**
 * For the purposes of wooter,
 * This is not much of a channel
 * but more of a simplified version of a promise
 */
class Channel<T> {
	protected promise: Promise<T>

	private resolve: (value: T) => void
	#resolved: boolean = false

	get resolved() {
		return this.#resolved
	}

	private set resolved(value: boolean) {
		this.#resolved = value
	}

	constructor() {
		const { promise, resolve } = Promise.withResolvers<T>()
		this.promise = promise
		this.resolve = resolve
	}

	push(value: T, _throw?: boolean) {
		if (this.resolved && _throw) {
			throw new EventAlreadyPushedError()
		}
		this.resolve(value)
		this.resolved = true
	}

	wait(): Promise<T> {
		return this.promise
	}
}

class EventAlreadyPushedError {}

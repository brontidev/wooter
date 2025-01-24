import type { Event, MiddlewareEvent } from "../event.ts"

export type Handler<
	Params extends Record<string, unknown> = Record<string, unknown>,
	Data extends Record<string, unknown> = Record<string, unknown>,
> = (event: Event<Params, Data>) => Promise<void>
export type MiddlewareHandler = (event: MiddlewareEvent) => Promise<void>

import type { Event, MiddlewareEvent } from "../event.ts"

/**
 * Handler for routes
 *
 * @param event Event
 * @returns Empty promise
 */
export type Handler<
	Params extends Record<string, unknown> = Record<string, unknown>,
	Data extends Record<string, unknown> = Record<string, unknown>,
> = (event: Event<Params, Data>) => Promise<void>

/**
 * Handler for middleware
 *
 * @param event Event
 * @returns Empty promise
 */
export type MiddlewareHandler<
	Params extends Record<string, unknown> = Record<string, unknown>,
	Data extends Record<string, unknown> = Record<string, unknown>,
> = (event: MiddlewareEvent<Params, Data>) => Promise<void>

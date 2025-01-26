import type { Event, MiddlewareEvent } from "../event.ts"

/**
 * Parameters
 */
export type Params = Record<string, unknown>

/**
 * Route data
 */
// deno-lint-ignore no-explicit-any
export type Data = Record<keyof any, unknown>

/**
 * Handler for routes
 *
 * @param event Event
 * @returns Empty promise
 */
export type Handler<
	TParams extends Params = Params,
	TData extends Data = Data,
> = (event: Event<TParams, TData>) => Promise<void>

/**
 * Handler for middleware
 *
 * @param event Event
 * @returns Empty promise
 */
export type MiddlewareHandler<
	TParams extends Params = Params,
	TData extends Data = Data,
	TNextData extends Data | undefined = Data,
> = (event: MiddlewareEvent<TParams, Data, TNextData>) => Promise<void>

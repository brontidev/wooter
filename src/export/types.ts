/**
 * Type representing route parameters
 */
export type Params = Record<string, unknown>

/**
 * Type representing router context data
 */
export type Data = Record<string, unknown>

/**
 * Internal wooter error class
 * All dev-facing errors extend from this class
 */
export class WooterError extends Error {}

export {
	type default as MiddlewareContext,
	type MiddlewareHandler,
} from "../ctx/MiddlewareContext.ts"
export {
	type default as RouteContext,
	type RouteHandler,
} from "../ctx/RouteContext.ts"

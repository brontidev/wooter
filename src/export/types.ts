/**
 * Type representing route parameters
 */
export type Params = Record<string, unknown>

/**
 * Type representing router context data
 */
export type Data = Record<string, unknown>

export { type default as MiddlewareContext, type MiddlewareHandler } from "../ctx/MiddlewareContext.ts"
export { type default as RouteContext, type RouteHandler } from "../ctx/RouteContext.ts"

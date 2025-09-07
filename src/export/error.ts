/**
 * Internal wooter error class
 * All dev-facing errors extend from this class
 */
export class WooterError extends Error {}

export { HandlerDidntRespondError } from "@/ctx/RouteContext.ts"
export { MiddlewareHandlerDidntCallUpError } from "@/ctx/MiddlewareContext.ts"

import { AsyncLocalStorage } from "node:async_hooks"

/**
 * A symbol that can be thrown to silently exit the lifecycle
 * note: only exits cleanly if response is sent
 */
export const ControlFlowBreak = Symbol("ControlFlowBreak")

/**
 * A symbol that can be thrown to silently exit the lifecycle
 * note: only exits cleanly if response is sent
 */
export type ControlFlowBreak = typeof ControlFlowBreak

export const strayErrorStore = new AsyncLocalStorage<(e: unknown) => void>()

/**
 * Internal wooter error class
 * All dev-facing errors extend from this class
 */
export default class WooterError extends Error {}

/**
 * Checks if a value is an internal wooter error
 * @param v - Value to check
 */
export function isWooterError(v: unknown): v is WooterError {
	return v instanceof WooterError || v == ControlFlowBreak
}

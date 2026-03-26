import { AsyncLocalStorage } from "node:async_hooks"
export const ControlFlowBreak = Symbol("ControlFlowBreak")
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
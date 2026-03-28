import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Sentinel error used to abort handler execution without surfacing as a failure.
 *
 * Throw this after sending a response to stop further lifecycle work.
 */
export const ControlFlowBreak = Symbol("ControlFlowBreak")

/**
 * Type of {@link ControlFlowBreak}.
 */
export type ControlFlowBreak = typeof ControlFlowBreak

/**
 * Async-local store containing the active stray-error sink for the current request.
 */
export const strayErrorStore = new AsyncLocalStorage<(e: unknown) => void>()

export function catchStrayError(e: unknown) {
	strayErrorStore.getStore()!(e)
}

/**
 * Base error class for framework-level errors.
 */
export default class WooterError extends Error {}

/**
 * Checks whether a value is a known internal framework error.
 *
 * @param v Value to test.
 * @returns `true` when `v` is a `WooterError` or `ControlFlowBreak`.
 */
export function isWooterError(v: unknown): v is WooterError {
	return v instanceof WooterError || v == ControlFlowBreak
}

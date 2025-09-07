import { WooterError } from "./types.ts"

/**
 * Checks if a value is an internal wooter error
 * @param v - Value to check
 */
export function isWooterError(v: unknown): v is WooterError {
	return v instanceof WooterError
}

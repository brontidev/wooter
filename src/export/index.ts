import { WooterError } from "./error.ts"
export * from "./error.ts"
/**
 * Checks if a value is an internal wooter error
 * @param v - Value to check
 */
export function isWooterError(v: unknown): v is WooterError {
	return v instanceof WooterError
}

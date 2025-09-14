import WooterError from "@/WooterError.ts"
export * from "@@/error.ts"

export * as c from "@@/chemin.ts"
export { Option } from "@@/option.ts"
export { Result } from "@@/result.ts"
export { default as Wooter } from "@/Wooter.ts"
/**
 * Checks if a value is an internal wooter error
 * @param v - Value to check
 */
export function isWooterError(v: unknown): v is WooterError {
	return v instanceof WooterError
}

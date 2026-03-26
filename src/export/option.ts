/**
 * Option utility exports.
 *
 * @module
 */

import type * as c from "./chemin.ts"

import { none, Option, some, UnwrapNoneError } from "@bronti/robust/Option"
export { none, Option, some, UnwrapNoneError }

/**
 * Converts a `chemin` optional value to an `Option`.
 *
 * @param optionalValue `chemin` optional value.
 * @returns `some(value)` when present, otherwise `none()`.
 */
export function optionalValueToOption<T>(optionalValue: c.OptionalValue<T>): Option<T> {
	if (optionalValue.present) {
		return some(optionalValue.value)
	}
	return none()
}

/**
 * @module
 */

import type * as c from "./chemin.ts"

import { none, Option, some, UnwrapNoneError } from "@bronti/robust/Option"
export { none, Option, some, UnwrapNoneError }

/**
 * Converts a chemin optional parameter to an Option
 * @param optionalValue chemin OptionalValue
 * @returns Option
 */
export function optionalValueToOption<T>(optionalValue: c.OptionalValue<T>): Option<T> {
	if (optionalValue.present) {
		return some(optionalValue.value)
	}
	return none()
}

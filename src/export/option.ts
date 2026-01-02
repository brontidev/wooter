/**
 * Exports [@oxi/option](https://jsr.io/@oxi/option)
 *
 * @module
 */

import type * as c from "./chemin.ts"
import { Option } from "@oxi/option"

export * from "@oxi/option"

/**
 * Converts a chemin optional parameter to an Option
 * @param optionalValue chemin OptionalValue
 * @returns Option
 */
export function optionalValueToOption<T>(optionalValue: c.OptionalValue<T>): Option<T> {
	if (optionalValue.present) {
		return Option.Some(optionalValue.value)
	}
	return Option.None
}

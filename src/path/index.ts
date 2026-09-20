import { single, wrap } from "./matcher.ts"
import type { Matcher, Param, Path } from "./types.ts"

/** Builds a typed route path from literal segments and parameters. */
export const path = <const TPath extends Path>(...path: TPath): TPath => path

/** Creates a named route parameter, optionally parsed by a matcher. */
export function param<Name extends string>(name: Name): Param<Name, string>
/** Creates a named route parameter parsed by a matcher. */
export function param<Name extends string, T>(name: Name, matcher: Matcher<T, undefined>): Param<Name, T, undefined>
/** Creates a named route parameter parsed by a matcher with options. */
export function param<Name extends string, T, Options>(
	name: Name,
	matcher: Matcher<T, Options>,
	options: Options,
): Param<Name, T, Options>
export function param(name: string, matcher?: Matcher<any, any>, options?: any): Param<any, any, any> {
	return matcher ? { name, matcher, options } : { name }
}

/** Matches a segment and converts it to a number. */
export const num: Matcher<number> = single<number>(function num(seg) {
	const value = Number(seg)
	if (isNaN(value)) return { ok: false }
	return { ok: true, value }
})

/** Matches and returns one non-empty path segment. */
export const passthrough: Matcher<string> = single<string>((value) => value ? ({ ok: true, value }) : { ok: false })

/** Repeats a matcher zero or more times, or one or more times when requested. */
export function multiple<T, Opt>(matcher: Matcher<T, Opt>, at_least_one = false): Matcher<T[], Opt> {
	return wrap<T[], Opt>(
		(path, i, opt) => {
			let consume = 0
			const value = []

			while (true) {
				const result = matcher(path, i, opt)
				if (result.ok) {
					value.push(result.value)
					i += result.consume
					consume += result.consume
					continue
				}
				break
			}

			if (consume == 0 && at_least_one) return { ok: false }
			return { ok: true, consume, value }
		},
		matcher.name,
		(name) => name + (at_least_one ? "+" : "*"),
	)
}

/** Matches the remaining path segments. */
export const rest: Matcher<string[]> = multiple(passthrough)

/** Makes a matcher optional. */
export function optional<T, Opt>(matcher: Matcher<T, Opt>): Matcher<T | undefined, Opt> {
	return wrap<T | undefined, Opt>(
		(path, i, opt) => {
			const result = matcher(path, i, opt)
			return result.ok ? result : { ok: true, value: undefined, consume: 0 }
		},
		matcher.name,
		(name) => `${name}?`,
	)
}

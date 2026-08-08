import type { Matcher } from "./types.ts"

export const matcher = <T, Options = undefined>(
	matcher: Matcher<T, Options>,
): Matcher<T, Options> => matcher

export function single<T, Options = undefined>(
	fn: (seg: string, options: Options) => { ok: false } | { ok: true; value: T },
): Matcher<T, Options> {
	return wrap((path, i, opt) => {
		const result = fn(path[i], opt)
		return result.ok ? { ok: true, value: result.value, consume: 1 } : result
	}, fn.name)
}

export function wrap<T, Options = undefined>(
	fn: Matcher<T, Options>,
	name: string,
	transform?: (name: string) => string,
): Matcher<T, Options> {
	return Object.defineProperty(fn, "name", {
		value: name ? (transform ? transform(name) : name) : "",
		configurable: true,
	})
}

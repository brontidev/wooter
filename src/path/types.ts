import type { Merge } from "../types.ts"

/** Matches path segments and returns a parsed value and consumed count. */
export type Matcher<T, Options = undefined> = (
	path: string[],
	current_index: number,
	options: Options,
) => { ok: false } | { ok: true; value: T; consume: number }
/** Extracts the parsed value type from a matcher-bearing parameter. */
export type MatcherValue<P> = P extends { matcher: Matcher<infer T, any> } ? T : never

/** Describes a named route parameter with an optional matcher. */
export type Param<Name extends string = string, T = unknown, Options = undefined> = {
	name: Name
} | ({ name: Name; matcher: Matcher<T, Options>; options: Options })
/** Resolves the value type produced by a route parameter. */
export type ParamValue<P> = [MatcherValue<P>] extends [never] ? string : MatcherValue<P>

/** A typed sequence of literal and parameter path segments. */
export type Path = (Param | string)[]
/** Infers a parameter object from a typed path. */
export type ParamsOfPath<P extends readonly unknown[]> = P extends readonly [infer Head, ...infer Tail]
	? [Head] extends [Param<infer Name, any>] ? Merge<{ [K in Name]: ParamValue<Head> }, ParamsOfPath<Tail>>
	: ParamsOfPath<Tail>
	: Record<never, never>

import type { Merge } from "../types.ts"

export type Matcher<T, Options = undefined> = (
	path: string[],
	current_index: number,
	options: Options,
) => { ok: false } | { ok: true; value: T; consume: number }
export type MatcherValue<P> = P extends { matcher: Matcher<infer T, any> } ? T : never

export type Param<Name extends string = string, T = unknown, Options = undefined> = {
	name: Name
} | ({ name: Name; matcher: Matcher<T, Options>; options: Options })
export type ParamValue<P> = [MatcherValue<P>] extends [never] ? string : MatcherValue<P>

export type Path = (Param | string)[]
export type ParamsOfPath<P extends readonly unknown[]> = P extends readonly [infer Head, ...infer Tail]
	? [Head] extends [Param<infer Name, any>] ? Merge<{ [K in Name]: ParamValue<Head> }, ParamsOfPath<Tail>>
	: ParamsOfPath<Tail>
	: Record<never, never>

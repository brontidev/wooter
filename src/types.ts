/**
 * @internal
 * https://stackoverflow.com/a/49683575/15910952
 */
type OptionalPropertyNames<T> = {
	// deno-lint-ignore ban-types
	[K in keyof T]-?: ({} extends { [P in K]: T[K] } ? K : never)
}[keyof T]

/**
 * @internal
 * https://stackoverflow.com/a/49683575/15910952
 */
type SpreadProperties<L, R, K extends keyof L & keyof R> = {
	[P in K]: L[P] | Exclude<R[P], undefined>
}

/**
 * @internal
 * https://stackoverflow.com/a/49683575/15910952
 */
type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never

/**
 * @internal
 * https://stackoverflow.com/a/49683575/15910952
 */
export type Merge<L, R> = Id<
	& Pick<L, Exclude<keyof L, keyof R>>
	& Pick<R, Exclude<keyof R, OptionalPropertyNames<R>>>
	& Pick<R, Exclude<OptionalPropertyNames<R>, keyof L>>
	& SpreadProperties<L, R, OptionalPropertyNames<R> & keyof L>
>

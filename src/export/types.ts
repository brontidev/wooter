import type { Merge } from "@/types.ts"

/**
 * Generic route-parameter object shape.
 */
export type Params = Record<string, unknown>

/** Empty object shape used when no state or parameters are defined. */
export type EmptyObject = Record<never, never>

/**
 * Generic context state object shape.
 */
export type State = Record<string, unknown>

export type { default as MiddlewareContext, MiddlewareHandler } from "@/ctx/MiddlewareContext.ts"
export type { default as RouteContext, RouteHandler } from "@/ctx/RouteContext.ts"
export type { MethodDefinitionInput, MethodDefinitions } from "@/graph/Graph.ts"

export type { TypedMap } from "@bronti/robust/TypedMap"

/**
 * Conditionally merges two data/params types when either side may be undefined.
 *
 * @internal
 */
export type OptionalMerge<A extends Record<keyof any, unknown> | undefined, B extends Record<keyof any, unknown> | undefined> =
	A extends undefined ? B
		: (B extends undefined ? A : Merge<A, B>)

/**
 * HTTP methods for typed route declarations.
 */
export type Methods = "GET" | "PUT" | "POST" | "PATCH" | "DELETE" | "OPTIONS" | "QUERY"

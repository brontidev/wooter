import type { Merge } from "@/types.ts"

/**
 * Generic route-parameter object shape.
 */
export type Params = Record<string, unknown>

/**
 * Generic context-data object shape.
 */
export type Data = Record<string, unknown>

export type { default as MiddlewareContext, MiddlewareHandler } from "@/ctx/MiddlewareContext.ts"
export type { default as RouteContext, RouteHandler } from "@/ctx/RouteContext.ts"
export type { MethodDefinitionInput, MethodDefinitions } from "@/graph/RouterGraph.ts"

export type { TypedMap } from "@bronti/robust/TypedMap"

/**
 * Conditionally merges two data/params types when either side may be undefined.
 *
 * @internal
 */
export type OptionalMerge<OR, A extends OR | undefined, B extends OR | undefined> = A extends undefined ? B
	: (B extends undefined ? A : Merge<A, B>)

/**
 * Supported HTTP methods for typed route declarations.
 */
export type Methods = "GET" | "PUT" | "POST" | "PATCH" | "DELETE" | "OPTIONS"

import type { Merge } from "@/types.ts"

/**
 * Type representing route parameters
 */
export type Params = Record<string, unknown>

/**
 * Type representing router context data
 */
export type Data = Record<string, unknown>

export type { default as MiddlewareContext, MiddlewareHandler } from "@/ctx/MiddlewareContext.ts"
export type { default as RouteContext, RouteHandler } from "@/ctx/RouteContext.ts"
export type { MethodDefinitionInput, MethodDefinitions } from "@/graph/RouterGraph.ts"

export type { TypedMap } from "@bronti/robust/TypedMap"

/**
 * @internal
 */
export type OptionalMerge<OR, A extends OR | undefined, B extends OR | undefined> = A extends undefined ? B
	: (B extends undefined ? A : Merge<A, B>)

/**
 * valid HTTP methods
 */
export type Methods = "GET" | "PUT" | "POST" | "PATCH" | "DELETE" | "OPTIONS"

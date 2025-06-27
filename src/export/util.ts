import { useMiddleware } from "@/context/middleware.ts"
import type {
	Data,
	RouteHandler,
	Merge,
	MiddlewareHandler,
	Params,
} from "@/export/types.ts"
import { Context__chain, useHandler } from "@/context/index.ts"

/**
 * Returns a JSON `Response` given a stringifiable object
 * @param json - json data
 * @param init - Response init
 * @deprecated use `Response.json()` instead
 * @returns response
 */
export function jsonResponse(json: unknown, init?: ResponseInit): Response {
	const body = JSON.stringify(json)
	const headers = new Headers(init?.headers)

	if (!headers.has("content-length")) {
		headers.set(
			"content-length",
			encoder.encode(body).byteLength.toString(),
		)
	}
	if (!headers.has("content-type")) {
		headers.set("content-type", "application/json")
	}

	return new Response(body, {
		...init,
		headers,
	})
}
/**
 * Returns a redirect response given a location
 * @param location - redirect location
 * @param init - Response init
 * @returns response
 */
export function redirectResponse(
	location: string | URL,
	init?: ResponseInit,
): Response {
	const headers = new Headers(init?.headers)

	headers.set("Location", location.toString())
	return new Response(null, {
		...init,
		status: init?.status ?? 307,
		headers,
	})
}
/**
 * Returns an error response given a status code and message
 * @param status - Status code
 * @param message - message
 * @param headers - headers
 * @returns response
 */
export function errorResponse(
	status: number,
	message?: string,
	headers?: Headers,
): Response {
	return new Response(message, {
		status,
		statusText: message,
		headers,
	})
}

/**
 * Returns a url string provided the request and a path
 * @param request - Request
 * @returns Template tag
 */
export function fixLocation(
	request: Request,
): (strings: TemplateStringsArray, ...values: unknown[]) => string {
	const url = new URL(request.url)
	return (strings: TemplateStringsArray, ...values: unknown[]) => {
		const path = strings.reduce((result, str, i) => {
			return result + str + (values[i] ?? "")
		}, "")
		return `${url.origin}${path}`
	}
}

/**
 * Applies a middleware directly to a handler, returning a new handler
 * @param middleware - Middleware to apply
 * @param handler - Handler to apply middleware to
 * @returns Handler - Handler that wraps the handler in the middleware
 */
export function use<
	TParams extends Params,
	BaseData extends Data,
	NewData extends Data | undefined = undefined,
	TData extends Data = Merge<BaseData, NewData>,
>(
	middleware: MiddlewareHandler<Params, BaseData, NewData>,
	handler: RouteHandler<TParams, TData>,
): RouteHandler<TParams, TData> {
	return (context) => {
		useMiddleware(
			middleware as MiddlewareHandler,
			context.request,
			context.params,
			context.data,
			(data, request) => {
				return useHandler(
					handler as RouteHandler,
					request,
					context.params,
					data,
				)
			},
		)[Context__chain](context)
	}
}

const encoder = new TextEncoder()

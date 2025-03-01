import { MiddlewareEvent, useMiddleware } from "@/event/middleware.ts"
import type { MiddlewareHandler, Handler, Params, Data, StandaloneMiddlewareHandler, Merge} from "@/export/types.ts"
import { useHandler } from "@/event/index.ts"

/**
 * Returns a JSON `Response` given a stringifiable object
 * @param json - json data
 * @param init - Response init
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

export function use<TParams extends Params, BaseData extends Data, NewData extends Data | undefined = undefined, TData extends Data = Merge<BaseData, NewData>>(middleware: MiddlewareHandler<Params, BaseData, NewData>, handler: Handler<TParams, TData>): Handler<TParams, TData> {
  return (event) => {
    event.resp(useMiddleware(middleware, event.request, event.params, event.data, (data, request) => {
      return useHandler(handler, request, event.params, data)
    }))
  }
}

const encoder = new TextEncoder()

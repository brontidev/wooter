/**
 * Creates a redirect response.
 *
 * @param location Redirect destination.
 * @param init Optional response init. `status` defaults to `307`.
 * @returns Redirect response with `Location` header set.
 */
export function makeRedirect(location: string | URL, init?: ResponseInit): Response {
	const headers = new Headers(init?.headers)
	headers.set("Location", location.toString())
	return new Response(null, {
		...init,
		status: init?.status ?? 307,
		headers,
	})
}

/**
 * Creates an error response with an optional body message.
 *
 * @param status HTTP status code.
 * @param message Optional error message for body and status text.
 * @param headers Optional response headers.
 * @returns Error response.
 */
export function makeError(status: number, message?: string, headers?: HeadersInit): Response {
	return new Response(message, {
		status,
		statusText: message,
		headers,
	})
}

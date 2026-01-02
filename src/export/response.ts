/**
 * Creates a redirect Response
 * @param location Location to redirect to
 * @param init Request init object
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
 * Creates an error Response
 * @param status status code
 * @param message Error message
 * @param headers Request headers
 */
export function makeError(status: number, message?: string, headers?: HeadersInit): Response {
	return new Response(message, {
		status,
		statusText: message,
		headers,
	})
}

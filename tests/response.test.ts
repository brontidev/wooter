import { assertEquals, assert } from "@std/assert"
import { makeRedirect, makeError } from "@@/response.ts"

Deno.test("makeRedirect - creates redirect with default status 307", () => {
	const location = "https://example.com/new-path"
	const response = makeRedirect(location)
	
	assertEquals(response.status, 307)
	assertEquals(response.headers.get("Location"), location)
	assertEquals(response.body, null)
})

Deno.test("makeRedirect - accepts URL object", () => {
	const location = new URL("https://example.com/new-path")
	const response = makeRedirect(location)
	
	assertEquals(response.status, 307)
	assertEquals(response.headers.get("Location"), location.toString())
})

Deno.test("makeRedirect - custom status code", () => {
	const location = "/new-path"
	const response = makeRedirect(location, { status: 301 })
	
	assertEquals(response.status, 301)
	assertEquals(response.headers.get("Location"), location)
})

Deno.test("makeRedirect - preserves other headers", () => {
	const location = "/new-path"
	const response = makeRedirect(location, { 
		headers: { "X-Custom": "value" },
		status: 302
	})
	
	assertEquals(response.status, 302)
	assertEquals(response.headers.get("Location"), location)
	assertEquals(response.headers.get("X-Custom"), "value")
})

Deno.test("makeRedirect - overrides Location header if provided", () => {
	const location = "/new-path"
	const response = makeRedirect(location, { 
		headers: { "Location": "ignored" }
	})
	
	// makeRedirect should override the Location header
	assertEquals(response.headers.get("Location"), location)
})

Deno.test("makeError - creates error response with status", () => {
	const response = makeError(404)
	
	assertEquals(response.status, 404)
	assertEquals(response.statusText, undefined)
})

Deno.test("makeError - creates error response with message", async () => {
	const message = "Not Found"
	const response = makeError(404, message)
	
	assertEquals(response.status, 404)
	assertEquals(response.statusText, message)
	assertEquals(await response.text(), message)
})

Deno.test("makeError - creates error response with custom headers", () => {
	const response = makeError(500, "Internal Server Error", {
		"X-Error-Id": "12345"
	})
	
	assertEquals(response.status, 500)
	assertEquals(response.headers.get("X-Error-Id"), "12345")
})

Deno.test("makeError - common HTTP error codes", async () => {
	const error400 = makeError(400, "Bad Request")
	const error401 = makeError(401, "Unauthorized")
	const error403 = makeError(403, "Forbidden")
	const error404 = makeError(404, "Not Found")
	const error500 = makeError(500, "Internal Server Error")
	
	assertEquals(error400.status, 400)
	assertEquals(await error400.text(), "Bad Request")
	
	assertEquals(error401.status, 401)
	assertEquals(await error401.text(), "Unauthorized")
	
	assertEquals(error403.status, 403)
	assertEquals(await error403.text(), "Forbidden")
	
	assertEquals(error404.status, 404)
	assertEquals(await error404.text(), "Not Found")
	
	assertEquals(error500.status, 500)
	assertEquals(await error500.text(), "Internal Server Error")
})

// deno-lint-ignore-file no-explicit-any

import type { Data, MiddlewareContext, MiddlewareHandler, Params } from "@@/types.ts"
import { assertSpyCallArgs, type Spy, spy } from "@std/testing/mock"
import { assertEquals } from "@std/assert"
import c from "@@/chemin.ts"
import Wooter from "@/Wooter.ts"

const BASE_URL = new URL("http://example.com/")

function middlewareSpy<
	T extends unknown[],
	TParams extends Params = Params,
	TData extends Data | undefined = undefined,
	TNextData extends Data | undefined = undefined,
>(
	handler: (spy: Spy<any, T>, ctx: MiddlewareContext<TParams, TData, TNextData>) => Promise<unknown>,
): [Spy, MiddlewareHandler<TParams, TData, TNextData>] {
	const fn = spy<any, T>()
	return [fn, (ctx) => handler(fn, ctx)]
}

const useCatchErrors = () =>
	middlewareSpy(async (spy, ctx) => {
		try {
			await ctx.expectAndRespond({})
		} catch (e) {
			spy(e)
			ctx.resp(new Response("Internal Server Error", { status: 500 }))
		}
	})

function wooterFetch(wooter: Wooter, path: string, requestInit?: RequestInit): [URL, Request, Promise<Response>] {
	const url = new URL(path, BASE_URL)
	const request = new Request(url, requestInit)
	const responsePromise = wooter.fetch(request)
	return [url, request, responsePromise]
}

// Integration tests using helper functions

Deno.test("wooterFetch - helper creates proper request", async () => {
	const wooter = new Wooter()
	wooter.route(c.chemin("test"), "GET", (ctx) => {
		ctx.resp(new Response("OK"))
	})

	const [url, request, responsePromise] = wooterFetch(wooter, "/test")

	assertEquals(url.pathname, "/test")
	assertEquals(request.url, BASE_URL + "test")

	const response = await responsePromise
	assertEquals(response.status, 200)
})

Deno.test("useCatchErrors - middleware catches errors", async () => {
	const wooter = new Wooter()
	const [errorSpy, catchMiddleware] = useCatchErrors()
	const testError = new Error("Test error")

	wooter.use(catchMiddleware)
	wooter.route(c.chemin(), "GET", () => {
		throw testError
	})

	const [, , responsePromise] = wooterFetch(wooter, "/")
	const response = await responsePromise

	assertEquals(response.status, 500)
	assertEquals(await response.text(), "Internal Server Error")
	assertSpyCallArgs(errorSpy, 0, [testError])
})

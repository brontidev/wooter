// deno-lint-ignore-file no-explicit-any no-unused-vars

import type {
	c,
	HandlerDidntRespondError,
	HandlerRespondedTwiceError,
	isWooterError,
	middleware,
	MiddlewareCalledBlockBeforeNextError,
	MiddlewareHandlerDidntCallUpError,
	use,
	Wooter,
} from "@@/index.ts"
import type { Data, MiddlewareContext, MiddlewareHandler, Params } from "@@/types.ts"
import type { assertEquals } from "@std/assert/equals"

import {} from "@std/assert"
import { type assertSpyCall, type assertSpyCalls, type returnsArg, type Spy, spy } from "@std/testing/mock"

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
			await ctx.unwrapAndRespond({})
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

// TODO: write tests

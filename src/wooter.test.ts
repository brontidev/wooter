import { assert, assertEquals, fail } from "jsr:@std/assert"
import { Wooter } from "@/wooter.ts"
import c from "@/export/chemin.ts"
import {
	ExitWithoutResponse,
	LockedNamespaceBuilder,
	MiddlewareCalledUpTooManyTimes,
	MiddlewareDidntCallUp,
} from "@/export/error.ts"

import { assertSpyCall, stub } from "jsr:@std/testing/mock"
import type { StandaloneMiddlewareHandler } from "@/export/types.ts"
import type { NamespaceBuilder } from "@/export/index.ts"

class TestError {}

const testHeader: StandaloneMiddlewareHandler<
	{ setTestHeader: (value: string) => void }
> = async ({ up, resp }) => {
	let header: string | undefined
	const response = (await up({
		setTestHeader: (value) => {
			header = value
		},
	})).unwrap()
	if (header) response.headers.set("X-Test", header)
	resp(response)
}

Deno.test("Wooter - basic route handling", async () => {
	const wooter = new Wooter()
	wooter.route(c.chemin("test"), {
		GET({ resp }) {
			resp(new Response("Hello, world!"))
		},
	})

	const request = new Request("http://localhost/test", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "Hello, world!")
})

Deno.test("Wooter - not found handler", async () => {
	const wooter = new Wooter()
	wooter.notFound(({ resp }) => {
		resp(new Response("Custom Not Found", { status: 404 }))
	})

	const request = new Request("http://localhost/unknown", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 404)
	assertEquals(text, "Custom Not Found")
})

Deno.test("Wooter - error handling", async () => {
	const wooter = new Wooter()
	wooter.route.GET(c.chemin("error"), async () => {
		throw new Error("Test error")
	})

	wooter.use(async ({ up, resp, block }) => {
	    try {
    	    (await up()).unwrap()
            await block
		} catch (error) {
		    resp(new Response("Internal Server Error", { status: 500 }))
    		console.error(error)
		}
	})

	const request = new Request("http://localhost/error", { method: "GET" })
	const response = await wooter.fetch(request)

	const text = await response.text()

	assertEquals(response.status, 500)
	assertEquals(text, "Internal Server Error")
})

Deno.test("Wooter - namespace handling", async () => {
	const wooter = new Wooter()
	wooter.namespace(c.chemin("api"), (subWooter) => {
		subWooter.route.GET(c.chemin("test"), ({ resp }) => {
			resp(new Response("Namespace Test"))
		})
	})

	const request = new Request("http://localhost/api/test", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "Namespace Test")
})

Deno.test("Wooter - middleware", async () => {
	const wooter = new Wooter().use(testHeader)
	wooter.route.GET(c.chemin("page"), ({ data: { setTestHeader }, resp }) => {
		setTestHeader("HELLO")
		resp(new Response("world"))
	})

	const request = new Request("http://localhost/page", { method: "GET" })
	const response = await wooter.fetch(request)

	assertEquals(response.status, 200)
	assertEquals(response.headers.get("X-Test"), "HELLO")
})

Deno.test("Wooter - middleware - call up twice", async () => {
	const wooter = new Wooter({ catchErrors: false }).use<
		{ setTestHeader: (value: string) => void }
	>(async ({ up, resp }) => {
		let header: string | undefined
		const response = (await up({
			setTestHeader: (value) => {
				header = value
			},
		})).unwrap();
		await up({
			setTestHeader: (value) => {
				header = value
			},
		})
		if (header) response.headers.set("X-Test", header)
		resp(response)
	})
	wooter.route.GET(c.chemin("page"), ({ data: { setTestHeader }, resp }) => {
		setTestHeader("HELLO")
		resp(new Response("world"))
	})

	try {
		const request = new Request("http://localhost/page", { method: "GET" })
		await wooter.fetch(request)
		fail("Wooter caught the error!")
	} catch (e) {
		assert(e instanceof MiddlewareCalledUpTooManyTimes)
	}
})

Deno.test("Wooter - middleware - didn't call up", async () => {
	const wooter = new Wooter({ catchErrors: false }).use<
		{ setTestHeader: (value: string) => void }
	>(async () => {
	})

	wooter.route.GET(c.chemin("page"), ({ data: { setTestHeader }, resp }) => {
		setTestHeader("HELLO")
		resp(new Response("world"))
	})

	try {
		const request = new Request("http://localhost/page", { method: "GET" })
		await wooter.fetch(request)
		fail("Wooter caught the error!")
	} catch (e) {
		assert(e instanceof MiddlewareDidntCallUp)
	}
})

Deno.test("Wooter - middleware - called up but not resp", async () => {
	const wooter = new Wooter().use(async ({ up }) => {
		await up()
	})

	wooter.route.GET(c.chemin("page"), ({ resp }) => {
		resp(new Response("world"))
	})

	const request = new Request("http://localhost/page", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "world")
})

Deno.test("Wooter - notFound set twice", () => {
	const warn = stub(console, "warn")

	new Wooter().notFound(() => {}).notFound(() => {})
	assertSpyCall(warn, 0, { args: ["notFound handler set twice"] })
})

Deno.test("Wooter - notFound has an error", async () => {
	const error = stub(console, "error")
	const testerror = new TestError()
	const wooter = new Wooter().notFound(() => {
		throw testerror
	})

	const request = new Request("http://localhost/page", { method: "GET" })
	const response = await wooter.fetch(request)

	assertEquals(response.status, 404)
	assertSpyCall(error, 0, {
		args: ["Unresolved error in notFound handler", testerror],
	})
})

Deno.test("Wooter - don't catch errors", async () => {
	const wooter = new Wooter({ catchErrors: false })
	wooter.route.GET(c.chemin("page"), () => {
		throw new TestError()
	})
	try {
		const request = new Request("http://localhost/page", { method: "GET" })
		await wooter.fetch(request)
		fail("Wooter caught the error!")
	} catch (e) {
		assert(e instanceof TestError)
	}
})

Deno.test("No response", async () => {
	const wooter = new Wooter({ catchErrors: false })
	wooter.route.GET(c.chemin("page"), () => {
	})
	try {
		const request = new Request("http://localhost/page", { method: "GET" })
		await wooter.fetch(request)
		fail("Wooter caught the error!")
	} catch (e) {
		assert(e instanceof ExitWithoutResponse)
	}
})

Deno.test("Namespace with another route after", async () => {
	const wooter = new Wooter()

	wooter.namespace(
		c.chemin("something"),
		(wooter) => {
			wooter.route.GET(c.chemin("page"), ({ resp }) => {
				resp(new Response("page"))
			})
		},
	)
	wooter.namespace(
		c.chemin("api"),
		(wooter) => {
			wooter.route.GET(c.chemin("page"), ({ resp }) => {
				resp(new Response("page"))
			})
		},
	)
	wooter.route.GET(c.chemin("api"), ({ resp }) => {
		resp(new Response(""))
	})

	const request = new Request("http://localhost/api", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "")
})

Deno.test("Nested Namespaces", async () => {
	const wooter = new Wooter()

	wooter.namespace(
		c.chemin("something"),
		(wooter) => {
			wooter.namespace(
				c.chemin("else"),
				(wooter) => {
					wooter.route.GET(c.chemin("page"), ({ resp }) => {
						resp(new Response("nested middleware!!"))
					})
				},
			)
			wooter.route.GET(c.chemin("page"), ({ resp }) => {
				resp(new Response("page"))
			})
		},
	)

	wooter.route.GET(c.chemin("api"), ({ resp }) => {
		resp(new Response(""))
	})

	const request = new Request("http://localhost/something/else/page", {
		method: "GET",
	})
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "nested middleware!!")
})

Deno.test("Namespace Builder breaks after it is locked", () => {
	let builder: NamespaceBuilder

	const wooter = new Wooter()

	wooter.namespace(c.chemin(), (bldr) => {
		builder = bldr
	})

	try {
		// @ts-expect-error: You aren't supposed to do this in the first place, this error is intended.
		builder.use()
		fail("Builder should error out since it was already locekd")
	} catch (e) {
		assert(e instanceof LockedNamespaceBuilder)
	}
})

Deno.test("Namespace with Middleware", async () => {
	const wooter = new Wooter()

	wooter.namespace(
		c.chemin("api"),
		(bldr) => bldr.use(testHeader),
		(wooter) => {
			wooter.route.GET(
				c.chemin(),
				({ resp, data: { setTestHeader } }) => {
					setTestHeader("HELLO")
					resp(new Response("world"))
				},
			)
		},
	)

	const request = new Request("http://localhost/api", { method: "GET" })
	const response = await wooter.fetch(request)

	assertEquals(response.status, 200)
	assertEquals(response.headers.get("X-Test"), "HELLO")
})

Deno.test("Multiple methods", async () => {
	const wooter = new Wooter()

	wooter.route(c.chemin("page"), {
		POST({ resp }) {
			resp(new Response("ok"))
		},
		GET({ resp }) {
			resp(new Response("ok"))
		},
	})

	const request = new Request("http://localhost/page", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "ok")
})

// TODO: re-implement this function (#18)

// Deno.test("namespace with existing wooter", async () => {
// 	const wooter1 = new Wooter()
// 	wooter1.route.GET(c.chemin("page"), ({ resp }) => {
// 		resp(new Response("ok"))
// 	})

// 	const wooter2 = new Wooter()
// 	wooter2.namespace(c.chemin("namespace"), wooter1)

// 	const request = new Request("http://localhost/namespace/page", {
// 		method: "GET",
// 	})
// 	const response = await wooter2.fetch(request)
// 	const text = await response.text()

// 	assertEquals(response.status, 200)
// 	assertEquals(text, "ok")
// })

Deno.test("default 404", async () => {
	const wooter = new Wooter()

	const request = new Request("http://localhost/unknown", { method: "GET" })
	const response = await wooter.fetch(request)

	assertEquals(response.status, 404)
})

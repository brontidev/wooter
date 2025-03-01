import { assert, assertEquals, fail } from "jsr:@std/assert"
import { Wooter } from "@/wooter.ts"
import { chemin } from "@/export/chemin.ts"
import {
	ExitWithoutResponse,
	MiddlewareCalledUpTooManyTimes,
	MiddlewareDidntCallUp,
} from "@/export/error.ts"

import { assertSpyCall, stub } from "jsr:@std/testing/mock"

class TestError {}

Deno.test("Wooter - basic route handling", async () => {
	const wooter = new Wooter()
	wooter.route(chemin("test")).GET(({ resp }) => {
		resp(new Response("Hello, world!"))
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

Deno.test("Wooter - internal server error", async () => {
	const wooter = new Wooter()
	wooter.route(chemin("error")).GET(() => {
		throw new Error("Test error")
	})

	const request = new Request("http://localhost/error", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 500)
	assertEquals(text, "Internal Server Error")
})

Deno.test("Wooter - namespace handling", async () => {
	const wooter = new Wooter()
	wooter.namespace(chemin("api"), (subWooter) => {
		subWooter.route(chemin("test")).GET(({ resp }) => {
			resp(new Response("Namespace Test"))
		})
	})

	const request = new Request("http://localhost/api/test", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "Namespace Test")
})

Deno.test("Wooter - methods proxy", async () => {
	const wooter = Wooter.withMethods()

	wooter.GET(chemin("page"), ({ resp }) => {
		resp(new Response("Methods!"))
	})

	const request = new Request("http://localhost/page", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "Methods!")
})

Deno.test("Wooter - middleware", async () => {
	const wooter = Wooter.withMethods().use<
		{ setTestHeader: (value: string) => void }
	>(async ({ up, resp }) => {
		let header: string | undefined
		const response = await up({
			setTestHeader: (value) => {
				header = value
			},
		})
		if (header) response.headers.set("X-Test", header)
		resp(response)
	})
	wooter.GET(chemin("page"), ({ data: { setTestHeader }, resp }) => {
		setTestHeader("HELLO")
		resp(new Response("world"))
	})

	const request = new Request("http://localhost/page", { method: "GET" })
	const response = await wooter.fetch(request)

	assertEquals(response.status, 200)
	assertEquals(response.headers.get("X-Test"), "HELLO")
})

Deno.test("Wooter - middleware - call up twice", async () => {
	const wooter = Wooter.withMethods({ catchErrors: false }).use<
		{ setTestHeader: (value: string) => void }
	>(async ({ up, resp }) => {
		let header: string | undefined
		const response = await up({
			setTestHeader: (value) => {
				header = value
			},
		})
		await up({
			setTestHeader: (value) => {
				header = value
			},
		})
		if (header) response.headers.set("X-Test", header)
		resp(response)
	})
	wooter.GET(chemin("page"), ({ data: { setTestHeader }, resp }) => {
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
	const wooter = Wooter.withMethods({ catchErrors: false }).use<
		{ setTestHeader: (value: string) => void }
	>(async () => {
	})

	wooter.GET(chemin("page"), ({ data: { setTestHeader }, resp }) => {
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
	const wooter = Wooter.withMethods().use(async ({ up }) => {
		await up()
	})

	wooter.GET(chemin("page"), ({ resp }) => {
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
	wooter.addRoute("GET", chemin("page"), () => {
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
	wooter.addRoute("GET", chemin("page"), () => {
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
	const wooter = new Wooter().useMethods()

	wooter.namespace(
		chemin("something"),
		(wooter) => wooter.useMethods(),
		(wooter) => {
			wooter.GET(chemin("page"), ({ resp }) => {
				resp(new Response("page"))
			})
		},
	)
	wooter.namespace(
		chemin("api"),
		(wooter) => wooter.useMethods(),
		(wooter) => {
			wooter.GET(chemin("page"), ({ resp }) => {
				resp(new Response("page"))
			})
		},
	)
	wooter.GET(chemin("api"), ({ resp }) => {
		resp(new Response(""))
	})

	const request = new Request("http://localhost/api", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "")
})

Deno.test("Multiple methods", async () => {
	const wooter = new Wooter()

	wooter.route(chemin("page"))
		.POST(({ resp }) => {
			resp(new Response("ok"))
		})
		.GET(({ resp }) => {
			resp(new Response("ok"))
		})

	const request = new Request("http://localhost/page", { method: "GET" })
	const response = await wooter.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "ok")
})

Deno.test("namespace with existing wooter", async () => {
	const wooter1 = new Wooter().useMethods()
	wooter1.GET(chemin("page"), ({ resp }) => {
		resp(new Response("ok"))
	})

	const wooter2 = new Wooter()
	wooter2.namespace(chemin("namespace"), wooter1)

	const request = new Request("http://localhost/namespace/page", {
		method: "GET",
	})
	const response = await wooter2.fetch(request)
	const text = await response.text()

	assertEquals(response.status, 200)
	assertEquals(text, "ok")
})

Deno.test("default 404", async () => {
	const wooter = new Wooter()

	const request = new Request("http://localhost/unknown", { method: "GET" })
	const response = await wooter.fetch(request)

	assertEquals(response.status, 404)
})

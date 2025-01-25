// this is a simple example of wooter derived from the [oak example](https://github.com/oakserver/acorn/blob/main/_examples/server.ts)

import { Wooter } from "../src/export/index.ts"
import {
	errorResponse,
	fixLocation,
	jsonResponse,
	redirectResponse,
} from "../src/export/util.ts"
import { chemin, pNumber } from "../src/export/chemin.ts" // "@ts-rex/wooter/chemin"

import {
	parse,
	type ParseOptions,
	serialize,
	type SerializeOptions,
} from "npm:cookie"

const db = await Deno.openKv()

type Cookies = {
	get(name: string): string
	getAll(): Record<string, string | undefined>
	delete(name: string): void
	set(name: string, value: string, options?: Partial<SerializeOptions>): void
}

type Book = {
	author: string
	title: string
}

const wooter = new Wooter()
	.use<{ cookies: Cookies }>(async ({ request, resp, up }) => {
		const cookieHeader = request.headers.get("cookie") || ""
		const parsedCookies = parse(cookieHeader)
		const cookieMap: Record<
			string,
			{ value: string; opts?: Partial<SerializeOptions> }
		> = {}

		const cookies: Cookies = {
			get: (name: string) => cookieMap[name].value ?? parsedCookies[name],
			getAll: () =>
				Object.fromEntries(
					Object.entries(parsedCookies).concat(
						Object.entries(cookieMap).map(([name, { value }]) => {
							return [name, value]
						}),
					),
				),
			delete: (name: string) => {
				cookieMap[name] = { value: "", opts: { maxAge: 0 } }
			},
			set: (
				name: string,
				value: string,
				options?: Partial<SerializeOptions>,
			) => {
				cookieMap[name] = { value, opts: options }
			},
		}

		const response = await up({ cookies })

		// Get all cookies that were set during request handling
		const newCookies = Object.entries(cookieMap)
			.filter(([_, value]) =>
				typeof value === "object" && "name" in value
			)
			.filter(([_, cookie]) =>
				cookie && typeof cookie === "object" && "name" in cookie &&
				"value" in cookie
			)
			.map(([name, cookie]) =>
				serialize(name, cookie.value || "", {
					...cookie.opts,
					httpOnly: true, // Ensure cookies are httpOnly by default for security
					secure: true, // Ensure cookies are secure by default
				})
			)

		// Add cookies to response headers
		if (newCookies.length > 0) {
			const existingHeaders = new Headers(response.headers)
			newCookies.forEach((cookie) => {
				existingHeaders.append("Set-Cookie", cookie)
			})

			return resp(
				new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: existingHeaders,
				}),
			)
		}

		resp(response)
	})
	.useMethods()

wooter.GET(chemin(), async ({ resp, data: { cookies } }) => {
	const count = parseInt(cookies.get("count") ?? "0") + 1
	cookies.set("count", count.toString())
	resp(jsonResponse({
		hello: "world",
		count,
	}))
})

wooter.GET(chemin("redirect"), async ({ resp }) => {
	resp(redirectResponse(
		"/book/1",
		{
			status: 307,
		},
	))
})

wooter.route(chemin("book"))
	.GET(async ({ resp }) => {
		const books: Book[] = []
		const bookEntries = db.list<Book>({ prefix: ["books"] })
		for await (const { key, value } of bookEntries) {
			if (key[1] === "id") {
				continue
			}
			console.log(key, value)
			books.push(value)
		}
		resp(jsonResponse(books))
	})
	.POST(async ({ request, resp }) => {
		const body = await request.json()
		const idEntry = await db.get<number>(["books", "id"])
		const id = (idEntry.value ?? 0) + 1
		const result = await db.atomic()
			.check({ key: ["books", "id"], versionstamp: idEntry.versionstamp })
			.set(["books", "id"], id)
			.set(["books", id], body)
			.commit()
		if (!result.ok) {
			return resp(errorResponse(500, "Conflict updating the book id"))
		}
		resp(jsonResponse(
			body,
			{
				headers: {
					location: fixLocation(request)`/book/${id}`,
				},
			},
		))
	})

wooter.route(chemin("book", pNumber("id")))
	.GET(async ({ params: { id }, resp }) => {
		const maybeBook = await db.get<Book>(["books", id])
		if (!maybeBook.value) {
			return resp(errorResponse(404, "Book not found"))
		}
		resp(jsonResponse(maybeBook.value))
	})
	.PUT(async ({ params: { id }, request, resp }) => {
		const body = await request.json()
		const bookEntry = await db.get<Book>(["books", id])
		if (!bookEntry.value) {
			return resp(errorResponse(404, "Book not found"))
		}
		const result = await db.atomic()
			.check({ key: ["books", id], versionstamp: bookEntry.versionstamp })
			.set(["books", id], body)
			.commit()
		if (!result.ok) {
			return resp(errorResponse(500, "Conflict updating the book"))
		}
		resp(jsonResponse(body))
	})
	.PATCH(async ({ params: { id }, request, resp }) => {
		const body = await request.json()
		const bookEntry = await db.get<Book>(["books", id])
		if (!bookEntry.value) {
			return resp(errorResponse(404, "Book not found"))
		}
		const book = { ...bookEntry.value, ...body }
		const result = await db.atomic()
			.check({ key: ["books", id], versionstamp: bookEntry.versionstamp })
			.set(["books", id], book)
			.commit()
		if (!result.ok) {
			return resp(errorResponse(500, "Conflict updating the book"))
		}
		resp(jsonResponse(book))
	})
	.DELETE(async ({ params: { id }, resp }) => {
		await db.delete(["books", id])
		resp(jsonResponse({ message: "Book deleted" }))
	})

const { fetch } = wooter
Deno.serve({ port: 3000 }, fetch)

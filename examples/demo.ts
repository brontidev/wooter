// this is a simple example of wooter derived from the [oak example](https://github.com/oakserver/acorn/blob/main/_examples/server.ts)

import { Wooter } from "../src/export/index.ts"
import { errorResponse, fixLocation, redirectResponse } from "../src/export/util.ts"
import { chemin, pNumber } from "../src/export/chemin.ts" // "@ts-rex/wooter/chemin"

import { parse, serialize, type SerializeOptions } from "npm:cookie"

import { z, ZodError } from "npm:zod"

const db = await Deno.openKv()

type Cookies = {
	get(name: string): string | undefined
	getAll(): Record<string, string | undefined>
	delete(name: string): void
	set(name: string, value: string, options?: Partial<SerializeOptions>): void
}

const book = z.object({
	author: z.string(),
	title: z.string(),
})

const bookList = z.array(book)

type Book = z.infer<typeof book>

const bookPatch = z.object({
	author: z.optional(z.string()),
	title: z.optional(z.string()),
})

const wooter = new Wooter()
	.use<{ json: () => Promise<any> }>(async ({ request, resp, up, err }) => {
		let _json: any
		async function json() {
			if (_json) return _json
			try {
				// we want to clone this incase something else also wants to read the same request data!
				return _json = await request.clone().json()
			} catch (e) {
				return resp(
					new Response("Invalid JSON", {
						status: 400,
					}),
				)
			}
		}
		try {
			await up({ json })
		} catch (e) {
			if (e instanceof ZodError) {
				return resp(Response.json(e.issues, {
					status: 400,
				}))
			}
			err(e)
		}
	})
	.use<{ cookies: Cookies }>(async ({ request, resp, up }) => {
		const cookieHeader = request.headers.get("cookie") || ""
		const parsedCookies = parse(cookieHeader)
		const cookieMap: Map<
			string,
			{ value: string; opts?: Partial<SerializeOptions> }
		> = new Map()

		const cookies: Cookies = {
			get: (name: string) => cookieMap.get(name)?.value ?? parsedCookies[name],
			getAll: () =>
				Object.fromEntries(
					Object.entries(parsedCookies).concat(
						cookieMap.entries().toArray().map(
							([name, { value }]) => {
								return [name, value] as const
							},
						),
					),
				),
			delete: (name: string) => {
				cookieMap.set(name, { value: "", opts: { maxAge: 0 } })
			},
			set: (
				name: string,
				value: string,
				options?: Partial<SerializeOptions>,
			) => {
				cookieMap.set(name, { value, opts: options })
			},
		}

		const response = await up({ cookies })

		// Get all cookies that were set during request handling
		const newCookies = cookieMap.entries().toArray()
			.map(([name, cookie]) =>
				serialize(name, cookie.value || "", {
					...cookie.opts,
					httpOnly: true, // Ensure cookies are httpOnly by default for security
					secure: true, // Ensure cookies are secure by default
				})
			)

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

wooter.route.GET(chemin(), async ({ resp, data: { cookies } }) => {
	const count = parseInt(cookies.get("count") ?? "0") + 1
	cookies.set("count", count.toString())
	resp(Response.json({
		hello: "world",
		count,
	}))
})

wooter.route.GET(chemin("redirect"), async ({ resp }) => {
	resp(redirectResponse(
		"/book/1",
		{
			status: 307,
		},
	))
})

wooter.route(chemin("book"), {
	async GET({ resp }) {
		const books: Book[] = []
		const bookEntries = db.list<Book>({ prefix: ["books"] })
		for await (const { key, value } of bookEntries) {
			if (key[1] === "id") {
				continue
			}
			console.log(key, value)
			books.push(value)
		}
		resp(Response.json(books))
	},
	async POST({ request, resp, data: { json } }) {
		const body = book.parse(await json())
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
		resp(Response.json(
			body,
			{
				headers: {
					location: fixLocation(request)`/book/${id}`,
				},
			},
		))
	},
})

wooter.route(chemin("book", pNumber("id")), {
	async GET({ params: { id }, resp }) {
		const maybeBook = await db.get<Book>(["books", id])
		if (!maybeBook.value) {
			return resp(errorResponse(404, "Book not found"))
		}
		resp(Response.json(maybeBook.value))
	},
	async PUT({ params: { id }, resp, data: { json } }) {
		const body = book.parse(await json())
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
		resp(Response.json(body))
	},
	async PATCH({ params: { id }, resp, data: { json } }) {
		const body = bookPatch.parse(await json())
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
		resp(Response.json(book))
	},
	async DELETE({ params: { id }, resp }) {
		await db.delete(["books", id])
		resp(Response.json("ok"))
	},
})

wooter.namespace(chemin(pNumber("a")), (wooter) => {
	wooter.route.GET(chemin(), async ({}) => {
	})
})

Deno.serve({ port: 3000 }, (request) => wooter.fetch(request))

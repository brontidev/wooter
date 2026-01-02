// this is a simple example of wooter derived from the [oak example](https://github.com/oakserver/acorn/blob/main/_examples/server.ts)

import { c, makeError, makeRedirect, Option, Wooter } from "@@/index.ts"

import { parse, serialize, type SerializeOptions } from "npm:cookie"
import { z, ZodError } from "npm:zod"
import { chemin, pNumber } from "../src/export/chemin.ts"

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
	.use<{ json: () => Promise<any> }>(async ({ request, resp, unwrapAndRespond }) => {
		let _json: any
		await unwrapAndRespond({
			json: async () => {
				if (_json) return _json
				try {
					return _json = await request.clone().json()
				} catch (e) {
					resp(
						makeError(400, "Invalid JSON"),
					)
					throw 0
				}
			},
		})
	})
	.use<{ parseJson: <TSchema extends z.Schema, T = z.infer<TSchema>>(schema: TSchema) => Promise<T> }>(
		async ({ data, resp, unwrapAndRespond }) => {
			const json = data.get("json")
			await unwrapAndRespond({
				// @ts-ignore: I didn't feel like rewriting the types
				parseJson: async (schema) => {
					const result = schema.safeParse(await json())
					if (result.success) {
						return result.data
					} else {
						resp(Response.json(result.error.issues))
						throw 0
					}
				},
			})
		},
	)
	.use<{ cookies: Cookies }>(async ({ request, resp, unwrap }) => {
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

		const response = await unwrap({ cookies })

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

wooter.route(c.chemin(), "GET", async ({ resp, data }) => {
	const cookies = data.get("cookies")
	const count = Option.from(cookies.get("count")).map((x) => parseInt(x)).unwrapOr(0) + 1
	cookies.set("count", count.toString())
	resp(Response.json({
		hello: "world",
		count,
	}))
})

wooter.route(c.chemin("redirect"), "GET", async ({ resp }) => {
	resp(makeRedirect(
		"/book/1",
		{
			status: 307,
		},
	))
})

wooter.route(c.chemin("book"), {
	async GET({ resp }) {
		resp(Response.json((await Array.fromAsync(db.list<Book>({ prefix: ["books"] })))
			.filter(({ key }) => key[1] !== "id")))
	},
	async POST({ request, resp, data, url }) {
		const parseJson = data.get("parseJson")
		const body = await parseJson(book)
		const idEntry = await db.get<number>(["books", "id"])
		const id = (idEntry.value ?? 0) + 1
		const result = await db.atomic()
			.check({ key: ["books", "id"], versionstamp: idEntry.versionstamp })
			.set(["books", "id"], id)
			.set(["books", id], body)
			.commit()
		if (!result.ok) {
			return resp(makeError(500, "Conflict updating the book id"))
		}
		resp(Response.json(
			body,
			{
				headers: {
					location: `${url.origin}/book/${id}`,
				},
			},
		))
	},
})

wooter.route(chemin("book", pNumber("id")), {
	async GET({ params, resp }) {
		const maybeBook = await db.get<Book>(["books", params.get("id")])
		resp(
			Option.from(maybeBook.value)
				.match((v) => Response.json(v), () => makeError(404, "Book not found")),
		)
	},
	async PUT({ params, data, resp }) {
		const parseJson = data.get("parseJson")
		const id = params.get("id")
		const body = await parseJson(book)
		const bookEntry = await db.get<Book>(["books", id])
		if (!bookEntry.value) {
			return resp(makeError(404, "Book not found"))
		}
		const result = await db.atomic()
			.check({ key: ["books", id], versionstamp: bookEntry.versionstamp })
			.set(["books", id], body)
			.commit()
		if (!result.ok) {
			return resp(makeError(500, "Conflict updating the book"))
		}
		resp(Response.json(body))
	},
	async PATCH({ params, data, resp }) {
		const parseJson = data.get("parseJson")
		const id = params.get("id")
		const body = await parseJson(bookPatch)
		const bookEntry = await db.get<Book>(["books", id])
		if (!bookEntry.value) {
			return resp(makeError(404, "Book not found"))
		}

		const book = { ...bookEntry.value, ...body }

		const result = await db.atomic()
			.check({ key: ["books", id], versionstamp: bookEntry.versionstamp })
			.set(["books", id], body)
			.commit()
		if (!result.ok) {
			return resp(makeError(500, "Conflict updating the book"))
		}
		resp(Response.json(book))
	},
	async DELETE({ params, resp }) {
		await db.delete(["books", params.get("id")])
		resp(new Response("OK"))
	},
})

Deno.serve({ port: 3000 }, (request) => wooter.fetch(request))

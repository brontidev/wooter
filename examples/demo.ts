/**
 * Wooter port of [@oak/acorn example server](https://github.com/oakserver/acorn/blob/main/_examples/server.ts)
 */

import { c, makeError, makeRedirect, Option, Wooter } from "@@/index.ts"

import { z } from "npm:zod"
import json from "./middleware/json.ts"
import cookies from "./middleware/cookies.ts"

const db = await Deno.openKv()

const book = z.object({
	author: z.string(),
	title: z.string(),
})

type Book = z.infer<typeof book>

const bookPatch = z.object({
	author: z.optional(z.string()),
	title: z.optional(z.string()),
})

const wooter = new Wooter()
	.use(cookies)
	.use(json)
	.use<{ parseJson: <TSchema extends z.Schema>(schema: TSchema) => Promise<z.infer<TSchema>> }>(
		async ({ data: { json }, resp, expectAndRespond, wait }) => {
			console.log("hi")
			await expectAndRespond({
				parseJson: async (schema) => {
					const result = schema.safeParse(await json())
					if (result.success) {
						return result.data
					} else {
						resp(Response.json(result.error.issues))
						throw void 0
					}
				},
			})
			console.log("after expectAndResponse")
		},
	)
wooter.route(c.chemin(), "GET", async ({ resp, data: { cookies } }) => {
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
	async POST({ resp, data: { parseJson }, url }) {
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

wooter.route(c.chemin("book", c.pNumber("id")), {
	async GET({ params, resp }) {
		const maybeBook = await db.get<Book>(["books", params.get("id")])
		resp(
			Option.from(maybeBook.value)
				.match((v) => Response.json(v), () => makeError(404, "Book not found")),
		)
	},
	async PUT({ params, data: { parseJson }, resp }) {
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
	async PATCH({ params, data: { parseJson }, resp }) {
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

// Deno.serve({ port: 3000 }, (request) => wooter.fetch(request))

const resp = await wooter.fetch(new Request("http://localhost:3000/book", { method: "POST", body: "This is some Invalid JSON" }))

console.log(resp)

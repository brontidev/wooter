/**
 * OpenHeart protocol API

GET /<domain>/<uid> to look up reactions for <uid> under <domain>
GET /<domain> to look up reactions for everything under <domain>

POST /<domain>/<uid> to send an emoji

<uid> must not contain a forward slash.
<domain> owner has the right to remove data under its domain scope.
 */

import { c, Wooter } from "../src/export/index.ts"
import { errorResponse } from "../src/export/util.ts"
import { jsonResponse } from "../src/export/util.ts"

/**
 * [emojis, 'example.com', 'uid', '🩷'] -> number
 *
 * [idempotency, 'randomkey'] -> 0
 */

const keys = {
	domain: (domain: string) => [domain],
	uid: (domain: string, uid: string) => [...keys.domain(domain), uid],
	emoji: (
		domain: string,
		uid: string,
		emoji: string,
	) => [...keys.uid(domain, uid), emoji],
}

const db = await Deno.openKv()

db.listenQueue(
	async (
		{ key, idempotency }: {
			key: [string, string, string]
			idempotency: string
		},
	) => {
		const idempotencyCheck = await db.get(["idempotency", idempotency])
		if (idempotencyCheck.value == null) return
		const count = await db.get<number>(key)

		const tx = db
			.atomic()
			.check(count, idempotencyCheck)
			.delete(idempotencyCheck.key)
			.set(count.key, (count.value ?? 0) + 1)

		await tx.commit()
	},
)
const wooter = new Wooter().use(async ({ up }) => {
	const response = await up()
	response.headers.set("Access-Control-Allow-Origin", "*")
	response.headers.set("Access-Control-Allow-Methods", "GET,POST")
	response.headers.set("Access-Control-Max-Age", "86400")
}).useMethods()

function ensureEmoji(emoji: string) {
	const segments = Array.from(
		new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
			emoji.trim(),
		),
	)
	const parsedEmoji = segments.length > 0 ? segments[0].segment : null

	if (/\p{Emoji}/u.test(parsedEmoji)) return parsedEmoji
}

wooter.namespace(
	c.chemin(c.pString("_domain")),
	(wooter) => wooter.useMethods(),
	(wooter) => {
		wooter.GET(
			c.chemin(c.pMultiple(c.pString("uid"), false)),
			async ({ resp, params: { _domain, uid } }) => {
				const domain = encodeURI(_domain)
				const kvList = db.list<number>({
					prefix: uid.length
						? keys.uid(domain, uid.join("/"))
						: keys.domain(domain),
				})

				resp(
					jsonResponse(
						(await Array.fromAsync(kvList)).reduce((obj, entry) => {
							obj[entry.key[2]] = entry.value
							return obj
						}, {}),
					),
				)
			},
		)

		wooter.POST(
			c.chemin(c.pMultiple(c.pString("uid"), true)),
			async ({ request, resp, params: { _domain, uid }, url }) => {
				const domain = encodeURI(_domain)
				const emoji = ensureEmoji(await request.text())
				if (!emoji) {
					return resp(
						errorResponse(
							400,
							"request body should contain an emoji",
						),
					)
				}

				const key = keys.emoji(domain, uid.join("/"), emoji)
				const count = await db.get<number>(key)

				const tx = db
					.atomic()
					.check(count)
					.set(count.key, (count.value ?? 0) + 1)

				const res = await tx.commit()
				if (!res.ok) {
					// fail safe!
					console.warn("failed to add:", key.join(" "))
					const idempotency = crypto.randomUUID()
					db.set(["idempotency", idempotency], 0)
					await db.enqueue({
						key,
						idempotency,
					}) // just try again and pretend everything was fine. advice from Tom Scott
				}
				const doRedirect = url.searchParams.get("redirect") ??
					request.headers.get("Referrer") ?? undefined
				const redirectHeaders = doRedirect
					? {
						"Location": doRedirect,
					}
					: {}
				resp(
					new Response("recorded", {
						status: doRedirect ? 303 : 201,
						headers: {
							...redirectHeaders,
						},
					}),
				)
			},
		)
	},
)

const { fetch } = wooter
export default { fetch }

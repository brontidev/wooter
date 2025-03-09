const url = "https://openheart.wooter.bronti.dev"

const doc = `
OpenHeart protocol API

${url}

GET /<domain>/<uid> to look up reactions for <uid> under <domain>
GET /<domain> to look up reactions for everything under <domain>

POST /<domain>/<uid> to send an emoji

<uid> must not contain a forward slash.
<domain> owner has the right to remove data under its domain scope.

( derived from https://github.com/dddddddddzzzz/api-oh )

----- Test in CLI -----
Send emoji:
curl -d '<emoji>' -X POST '${url}/example.com/uid'

Get all emoji counts for /example.com/uid:
curl '${url}/example.com/uid'
`

import { c, Wooter } from "jsr:@bronti/wooter@1.3.6"
import { errorResponse } from "jsr:@bronti/wooter@1.3.6/util"
import { nerdIcons, rubiks, withDates } from "jsr:@rubiks/rubiks@1.2.9"
const console = rubiks().use(withDates).use(nerdIcons())

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
		console.info(`recieved queue from ${key.join(" ")} (${idempotency})`)
		const idempotencyCheck = await db.get(["idempotency", idempotency])
		if (idempotencyCheck.value == null) {
			console.warn(
				`idempotency check failed for ${idempotency}, ignoring`,
			)
			return
		}
		const count = await db.get<number>(key)

		const tx = db
			.atomic()
			.check(count, idempotencyCheck)
			.delete(idempotencyCheck.key)
			.set(count.key, (count.value ?? 0) + 1)

		const res = await tx.commit()
		if (!res.ok) {
			console.warn(
				`failed to increment: ${
					key.join(" ")
				} for the second time, quitting`,
			)
		} else {
			console.info(`incremented ${key.join(" ")}`)
		}
	},
)
const wooter = new Wooter().use(async ({ up }) => {
	const response = await up()
	response.headers.set("Access-Control-Allow-Origin", "*")
	response.headers.set("Access-Control-Allow-Methods", "GET,POST")
	response.headers.set("Access-Control-Max-Age", "86400")
})

function ensureEmoji(emoji: string) {
	const segments = Array.from(
		new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
			emoji.trim(),
		),
	)
	const parsedEmoji = segments.length > 0 ? segments[0].segment : null

	if (/\p{Emoji}/u.test(parsedEmoji)) return parsedEmoji
}

wooter.route.GET(c.chemin(), async ({ resp }) => {
	resp(new Response(doc))
})

wooter.namespace(
	c.chemin(c.pString("_domain")),
	(wooter) => {
		wooter.route.GET(
			c.chemin(c.pMultiple(c.pString("uid"), false)),
			async ({ resp, params: { _domain, uid } }) => {
				const domain = encodeURI(_domain)
				const kvList = db.list<number>({
					prefix: uid.length
						? keys.uid(domain, uid.join("/"))
						: keys.domain(domain),
				})

				resp(
					Response.json(
						Object.fromEntries(
							(await Array.fromAsync(kvList)).reduce(
								(map, entry) => {
									const key = entry.key[2]
									const value = map.get(key) ?? 0
									map.set(key, value + (entry.value ?? 0))
									return map
								},
								new Map(),
							).entries(),
						),
					),
				)
			},
		)

		wooter.route.POST(
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
				console.info(`got request to increment ${key.join(" ")}`)
				const count = await db.get<number>(key)

				const tx = db
					.atomic()
					.check(count)
					.set(count.key, (count.value ?? 0) + 1)

				const res = await tx.commit()
				if (!res.ok) {
					// fail safe!
					console.warn(
						`failed to increment: ${key.join(" ")} (trying again)`,
					)
					const idempotency = crypto.randomUUID()
					db.set(["idempotency", idempotency], 0)
					await db.enqueue({
						key,
						idempotency,
					}) // just try again and pretend everything was fine. advice from Tom Scott (i think)
				} else {
					console.info(`incremented ${key.join(" ")}`)
				}
				const doRedirect = url.searchParams.get("redirect") ??
					request.headers.get("Referrer") ?? undefined
				resp(
					new Response("recorded", {
						status: doRedirect ? 303 : 201,
						headers: doRedirect
							? {
								"Location": doRedirect,
							}
							: {},
					}),
				)
			},
		)
	},
)

const { fetch } = wooter
export default { fetch }

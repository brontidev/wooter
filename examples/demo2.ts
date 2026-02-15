// This is another example of wooter, which shows off the middleware functionality and namespaces.

import { c, makeError, makeRedirect, Wooter } from "@@/index.ts"
import cookies from "./middleware/cookies.ts"

export class Redirect {
	status: number
	location: string

	/**
	 * @param {300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308} status
	 * @param {string} location
	 */
	constructor(
		status: 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308,
		location: string,
	) {
		this.status = status
		this.location = location
	}
}

const wooter = new Wooter()
	.use<{ redirect: (...args: ConstructorParameters<typeof Redirect>) => never }>(async ({ request, resp, expectResponse }) => {
		try {
			resp(
				await expectResponse({
					redirect: (...args) => {
						throw new Redirect(...args)
					},
				}, request),
			)
		} catch (e) {
			// doing err(new Redirect(...)) will run this
			if (e instanceof Redirect) {
				return resp(makeRedirect(
					e.location,
					{
						status: e.status,
					} satisfies ResponseInit,
				))
			}
			throw e
		}
	})
	.use(cookies)
	.use<{ username: string }>(async ({ request, resp, expectAndRespond }) => {
		let username = request.headers.get("x-username")
		if (!username) return resp(makeError(402, "Missing username"))
		await expectAndRespond({ username })
	})

{
	const authWooter = wooter.router(c.chemin("auth"))

	authWooter.route(c.chemin("auth"), "GET", async ({ request, resp, data: { cookies, redirect } }) => {
		let json = await request.json()
		if (!json.username || !json.password) {
			return resp(
				makeError(400, "Missing username or password"),
			)
		}
		if (json.username !== "admin" || json.password !== "admin") {
			return resp(
				makeError(401, "Invalid username or password"),
			)
		}
		cookies.set(
			"session",
			"example",
			{
				httpOnly: true,
				sameSite: "lax",
				maxAge: 86400 * 7,
				path: "/",
			},
		)
		redirect(302, "/home")
	})
}

{
	const apiWooter = wooter.router(c.chemin("api", c.pNumber("asd")))

	apiWooter.route(c.chemin("gateway"), "GET", async ({ resp, data: { username } }) => {
		resp(Response.json({ ok: true, msg: `Hello, ${username}` }))
	})
}

const { fetch } = wooter
Deno.serve({ port: 3000 }, fetch)

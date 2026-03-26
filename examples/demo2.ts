// This is another example of wooter, which shows off the middleware functionality and namespaces.

import { c, makeError, makeRedirect, Wooter } from "@@/index.ts"
import cookies from "./middleware/cookies.ts"

const wooter = new Wooter()
	.use<{ redirect: (status: 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308, location: string) => never }>(
		async ({ request, resp, forward, safeExit }) => {
			await forward({
				redirect: (status, location) => {
					resp(makeRedirect(
						location,
						{
							status,
						} satisfies ResponseInit,
					))
					return safeExit()
				},
			}, request)
		},
	)
	.use(cookies)
// .use<{ username: string }>(async ({ request, resp, pass }) => {
// 	let username = request.headers.get("x-username")
// 	if (!username) return resp(makeError(402, "Missing username"))
// 	await pass({ username })
// })

{
	const authWooter = wooter.router(c.chemin("auth"))

	authWooter.route(c.chemin(), "POST", async ({ request, resp, data: { cookies, redirect } }) => {
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

export default wooter

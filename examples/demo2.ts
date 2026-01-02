// This is another example of wooter, which shows off the middleware functionality and namespaces.

import { c, makeError, makeRedirect, Wooter } from "@@/index.ts"
import { parse, type ParseOptions, serialize, type SerializeOptions } from "npm:cookie"

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

type Cookies = {
	get(name: string): string | undefined
	getAll(): Record<string, string | undefined>
	delete(name: string): void
	set(name: string, value: string, options?: Partial<SerializeOptions>): void
}

const wooter = new Wooter()
	.use(async ({ request, resp, unwrap }) => {
		try {
			resp(await unwrap(request))
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
	.use<{ username: string }>(async ({ request, resp, unwrapAndRespond }) => {
		let username = request.headers.get("x-username")
		if (!username) return resp(makeError(402, "Missing username"))
		await unwrapAndRespond({ username })
	})

{
	const authWooter = wooter.router(c.chemin("auth"))

	authWooter.route(c.chemin("auth"), "GET", async ({ request, resp, data }) => {
		const cookies = data.get("cookies")

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
			} satisfies SerializeOptions,
		)
		throw new Redirect(302, "/home")
	})
}

{
	const apiWooter = wooter.router(c.chemin("api", c.pNumber("asd")))

	apiWooter.route(c.chemin("gateway"), "GET", async ({ request, resp, data }) => {
		const username = data.get("username")
		resp(Response.json({ ok: true }))
	})
}

const { fetch } = wooter
Deno.serve({ port: 3000 }, fetch)

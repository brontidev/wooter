// This is another example of wooter, which shows off the middleware functionality and namespaces.

import { Wooter } from "@ts-rex/wooter"
import {
	errorResponse,
	fixLocation,
	jsonResponse,
	redirectResponse,
} from "@ts-rex/wooter/util"
import { chemin, type pNumber } from "./src/export/chemin.ts"
import {
	parse,
	type ParseOptions,
	serialize,
	type SerializeOptions,
} from "npm:cookie"

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
	get(name: string): string
	getAll(): Record<string, string | undefined>
	delete(name: string): void
	set(name: string, value: string, options?: Partial<SerializeOptions>): void
}

const wooter = new Wooter()
	.use(async ({ request, resp, up }) => {
		try {
			await up()
		} catch (e) {
			// doing err(new Redirect(...)) will run this
			if (e instanceof Redirect) {
				return resp(redirectResponse(
					e.location,
					{
						status: e.status,
					} satisfies ResponseInit,
				))
			}
			throw e
		}
	})
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
	.use<{ username: string }>(async ({ request, resp, up }) => {
		let username = request.headers.get("x-username")
		if (!username) return resp(errorResponse(402, "Missing username"))
		await up({ username })
	})

wooter
	// TODO: version 1; namespaces
	// namespace creates a new wooter, modifies its routes,
	// and uses its fetch method to route the request into it, you can make namespaces in namespaces.
	.namespace(chemin("auth"), (wooter) => {
		wooter.GET(
			chemin("login"),
			async ({ request, resp, err, data: { cookies } }) => {
				let json = await request.json()
				if (!json.username || !json.password) {
					return resp(
						errorResponse(400, "Missing username or password"),
					)
				}
				if (json.username !== "admin" || json.password !== "admin") {
					return resp(
						errorResponse(401, "Invalid username or password"),
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
				err(new Redirect(302, "/home"))
			},
		)
	})
	.namespace(chemin("api"), (wooter) => {
		wooter.GET(
			"/gateway",
			async ({ request, resp, err, data: { username } }) => {
				const { socket, response } = Deno.upgradeWebSocket(request)
				resp(response)
				// do some socket stuff
			},
		)
	})

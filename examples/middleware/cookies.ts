import { middleware } from "@@/use.ts"

import { parse, serialize, type SerializeOptions } from "npm:cookie"

type CookieMap = {
	get(name: string): string | undefined
	getAll(): Record<string, string | undefined>
	delete(name: string): void
	set(name: string, value: string, options?: Partial<SerializeOptions>): void
}

const cookies = middleware<{ cookies: CookieMap }>(async ({ request, resp, expectResponse }) => {
	const cookieHeader = request.headers.get("cookie") || ""
	const parsedCookies = parse(cookieHeader)
	const cookieMap: Map<
		string,
		{ value: string; opts?: Partial<SerializeOptions> }
	> = new Map()

	const cookies: CookieMap = {
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

	const response = await expectResponse({ cookies })

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

export { type CookieMap, cookies }
export default cookies

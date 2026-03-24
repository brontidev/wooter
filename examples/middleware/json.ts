import { makeError } from "@@/index.ts"
import { middleware } from "@@/use.ts"

const json = middleware<{ json: () => Promise<any> }>(async ({ request, resp, forward, safeExit }) => {
	let _json: any
	await forward({
		json: async () => {
			if (_json) return _json
			try {
				return _json = await request.clone().json()
			} catch (e) {
				resp(
					makeError(400, "Invalid JSON"),
				)
				safeExit()
			}
		},
	})
})

export default json

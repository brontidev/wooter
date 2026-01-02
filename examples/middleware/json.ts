import { makeError } from "@@/index.ts"
import { middleware } from "@@/use.ts"

const json = middleware<{ json: () => Promise<any> }>(async ({ request, resp, unwrapAndRespond }) => {
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

export default json

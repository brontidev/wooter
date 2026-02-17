import { makeError } from "@@/index.ts"
import { middleware } from "@@/use.ts"
import { ControlFlowBreak } from "@/ControlFlowBreak.ts"

const json = middleware<{ json: () => Promise<any> }>(async ({ request, resp, expectAndRespond }) => {
	let _json: any
	await expectAndRespond({
		json: async () => {
			if (_json) return _json
			try {
				return _json = await request.clone().json()
			} catch (e) {
				resp(
					makeError(400, "Invalid JSON"),
				)
				throw ControlFlowBreak
			}
		},
	})
})

export default json

/**
 * A unique symbol used to break control flow after responding.
 * 
 * When thrown after calling `resp()`, this symbol indicates intentional
 * control-flow interruption rather than an actual error condition.
 * 
 * @example
 * ```ts
 * import { ControlFlowBreak } from "@@/index.ts"
 * 
 * const parseJson = middleware(async ({ request, resp, expectAndRespond }) => {
 *   await expectAndRespond({
 *     json: async () => {
 *       try {
 *         return await request.clone().json()
 *       } catch (e) {
 *         resp(new Response("Invalid JSON", { status: 400 }))
 *         throw ControlFlowBreak // Exits cleanly without propagating as error
 *       }
 *     },
 *   })
 * })
 * ```
 */
export const ControlFlowBreak = Symbol("ControlFlowBreak")

/**
 * Type representing the control flow break symbol
 */
export type ControlFlowBreak = typeof ControlFlowBreak

import { c, Wooter } from "@@/index.ts"
import { z } from "npm:zod"

const wooter = new Wooter()
    .use<{ parseJson: () => Promise<void> }>(async ({ resp, expectAndRespond, safeExit }) => {
        console.log('[parseJson middleware] Starting')
        await expectAndRespond({
            parseJson: async () => {
                console.log('[parseJson] About to respond and throw')
                resp(new Response("error"))
                safeExit()
            },
        })
        console.log('[parseJson middleware] After expectAndRespond')
    })

wooter.route(c.chemin("test"), "POST", async ({ data: { parseJson }, resp }) => {
    console.log('[route handler] Calling parseJson')
    await parseJson()
    throw new Error("something happened")
    resp(new Response("ok"))
})

const response = await wooter.fetch(new Request("http://localhost/test", { method: "POST" }))
console.log('Response:', response.status)
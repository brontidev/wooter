import { Wooter } from "@/Wooter.ts"
import c from "@/export/chemin.ts"

const app = new Wooter().use<{ auth: { user: string } }>(async ({ unwrapAndRespond }) => {
    console.log("middleware")
    await unwrapAndRespond({ auth: { user: "cleothegoat" } })
})

app.route(c.chemin(), 'GET', async ctx => {
    //...
})

app.route(c.chemin('post-or-get'), ['POST', 'GET'], async ctx => {
    //...
})

app.route(c.chemin('all'), '*', async ctx => {
    //...
})

app.route(c.chemin('complex'), {
    GET: async ctx => {
        //...
    },
    DELETE: async ctx => {
        //...
    }
})

const api = app.router(c.chemin('api'))

api.route(c.chemin('user', '@me'), 'GET', async ctx => {
    const auth = ctx.data.get('auth')

    ctx.resp(Response.json(auth.user))
})


export default { fetch: app.fetch }

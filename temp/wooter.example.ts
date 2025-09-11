import { Wooter } from "@/export/index.ts"
import c from "@/export/chemin.ts"

const app = new Wooter().use<{ auth: { user: string } }>(async ({ unwrapAndRespond }) => {
    console.log("middleware")
    await unwrapAndRespond({ auth: { user: "cleothegoat" } })
})

app.route(c.chemin(), 'GET', async ctx => {
    //...
})

app.route(c.chemin('3'), 'GET', async ctx => {
    ctx.resp(new Response("ok!"))
    throw new Error("this should throw0")
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

app.notFound(async ({ resp, request, url }) => resp(new Response(`not found ${request.method} ${url.pathname} @ ${new Date()}`)))

export default { fetch: app.fetch }

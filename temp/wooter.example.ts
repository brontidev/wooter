const auth = someAuthLibrary({
    // config
})

const app = new Wooter().use(auth.middleware)

app.router(c.chemin('auth'), auth.router)

app.route(c.chemin(), 'get', async ctx => {
    //...
})

app.route(c.chemin('post-or-get'), ['post', 'get'], async ctx => {
    //...
})

app.route(c.chemin('all'), '*', async ctx => {
    //...
})

app.route(c.chemin('complex'), {
    get: async ctx => {
        //...
    },
    delete: async ctx => {
        //...
    }
})

const api = app.router(c.chemin('api'))

api.route(c.chemin('user', '@me'), 'get', async ctx => {
    const auth = ctx.data.get('auth')

    ctx.resp(Response.json(auth.user))
})


export default app

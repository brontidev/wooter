// @ts-nocheck: This is a file demo-ing an API that doesn't exist yet

const wooter = new Wooter()


/*
# MiddlewareContext

.resp(response)

.up(data) -> starts running the next handler, resolves when the request is passed up
.block() -> called after .up(), resolves when the next handler is completely done

.pass(data) -> runs both .up(), .block() and .resp()
*/

wooter.use(async ctx => {
    console.log("This happens before the handler starts")
    const result = await ctx.up();
})

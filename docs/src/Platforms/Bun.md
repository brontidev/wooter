# Bun

To install wooter in bun, use the `jsr` cli:

```zsh
bunx jsr add @bronti/wooter
```

And then you can use it like this:

```ts
import { Wooter, c } from "@bronti/wooter"
$:const app = new Wooter()
$:
$:app.route.GET(c.chemin(), ({ resp }) => resp(new Response("hi")))
$:
$:Bun.serve({
$:  fetch: app.fetch,
$:  port: 8080,
$:})
```

And use the Bun.serve api to serve the app.

```ts
$:import { Wooter, c } from "@bronti/wooter"
$:
$:const app = new Wooter()
$:app.route.GET(c.chemin(), ({ resp }) => resp(new Response("hi")))
$:
Bun.serve({
  fetch: app.fetch,
  port: 8080,
})
```

Alternatively, you can do `export default app`

```ts
$:import { Wooter, c } from "@bronti/wooter"
$:
$:const app = new Wooter()
$:app.route.GET(c.chemin(), ({ resp }) => resp(new Response("hi")))
$:
export default app;
```

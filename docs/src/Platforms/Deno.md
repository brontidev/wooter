# Deno

Wooter was originally designed to be deno-first, and it's the platform where it's most tested, and all examples assume deno,
unless specified otherwise.

Since wooter is on JSR, you can import it using the `jsr:` specifier:

```ts
import { Wooter, c } from "jsr:@bronti/wooter"
$:const wooter = new Wooter()
$:wooter.route.GET(c.chemin(), async ({ resp }) => resp(new Response("hi")))
$:Deno.serve(wooter.fetch, { port: 8080 })
```

and you can run it like this:

```ts
$:import { Wooter, c } from "jsr:@bronti/wooter"
$:const wooter = new Wooter()
$:wooter.route.GET(c.chemin(), async ({ resp }) => resp(new Response("hi")))
Deno.serve(wooter.fetch, { port: 8080 })
```

Alternatively, you can do `export default app;`

```ts
$:import { Wooter, c } from "jsr:@bronti/wooter"
$:const app = new Wooter()
$:app.route.GET(c.chemin(), ({ resp }) => resp(new Response("hi")))
export default app;
```

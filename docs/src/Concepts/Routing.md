# Routing

wooter uses the [`@dldc/chemin`](https://jsr.io/@dldc/chemin) library to parse
paths. Chemins are slightly more complex than a string like `/:id`. A chemin is
constructed using the `chemin` function, provided with the parameters

wooter exports everything from the supported version of chemin as `c`

```ts
$:import { Wooter } from "jsr:@bronti/wooter"
import { c } from "jsr:@bronti/wooter"
// OR
import * as c from "jsr:@dldc/chemin"

$:const wooter = new Wooter()
$:
// Empty chemin means `/`
const path = c.chemin()
$:
$:wooter.get(path, async ({ err }) => err("not implemented"))
```

# Parameters

Parameters are provided to the route handler via the `params` property

This example uses a middleware that has provides a utility function to process a
database response, and a route with parameters.

```ts
import { c, Wooter } from "jsr:@bronti/wooter"

const wooter = new Wooter()
	.use<{ resp_db: (resp: DatabaseResponse) => void }>(
		async ({ up, resp }) => {
			await up({
				resp_db: (resp) => {
					if (resp.ok) {
						resp(Response.json(resp.data))
					} else if (resp.err instanceof DatabaseErrorNotFound) {
						rep(new Response("Object not found", { status: 404 }))
					} else {
						resp(new Response("Error occured"))
					}
				},
			})
		},
	)

wooter.get(
	c.chemin("book", c.pString("id")),
	async ({ params: { id }, data: { resp_db } }) => resp_db(await db.find(id)),
)
```

More information in [`@dldc/chemin`](https://jsr.io/@dldc/chemin/doc)

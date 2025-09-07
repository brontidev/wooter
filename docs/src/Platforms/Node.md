# Node.js

Node is a bit tricky when it comes to http servers, but any server implementation that provides APIs similar to the fetch API can
be used with wooter. For this example, we will use the [`@whatwg-node/server`](https://www.npmjs.com/package/@whatwg-node/server)
package to create a server.

```ts
// serverAdapter.ts
import { createServerAdapter } from '@whatwg-node/server'
$:import { Wooter, c } from "@bronti/wooter"
$:
$:const app = new Wooter()
$:app.route.GET(c.chemin(), ({ resp }) => resp(new Response("hi")))

// Create a server adapter using the fetch method from the wooter instance
export default createServerAdapter((request: Request) => {
  return app.fetch(request)
})
```

```ts
// main.ts
import { createServer } from "http"
import serverAdapter from "./serverAdapter"

// You can create your Node server instance by using our adapter
const server = createServer(serverAdapter)
// Then start listening on some port
server.listen(4000)
```

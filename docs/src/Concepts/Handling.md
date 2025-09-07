# Handling

Wooter uses 2 promises to when handling a response, one for the response itself, and one for the function call of the handler or
middleware. This is useful for things like logging, or sending extra data after the response is sent.

The response promise will resolve or reject when either the `resp` or `err` function from the
[`RouteEvent`](https://jsr.io/@bronti/wooter/doc/~/RouteEvent) is called. `err` is mainly for intentionally erroring out, such as
custom error classes, or repropagating caught errors.

```ts
$: import { Wooter, c } from "jsr:@bronti/wooter";
$: const app = new Wooter();
//                        ⬇️ This function (optionally) returns a promise
app.route.GET(c.chemin(), async ({ resp, err }) => {
    //                                ⬆️ `resp` and `err` are slightly modified
    //                                   `response` and `reject` functions for the response promise.
    console.log("User doesn't have response yet.");
    // The response gets sent back into the router.
    // The response promise has now been resolved,
    // but this function is still running.
    resp(new Response("HI"));
    console.log("User now has the response.");
});

$: export default app;
```

There are multiple ways to use `.route`:

## Legacy (`.route(METHOD, ...)`)

```ts
$: import { Wooter, c } from "jsr:@bronti/wooter";
$: const app = new Wooter();
app.route(c.chemin(), "GET", async ({ resp, err }) => {
    console.log("User doesn't have response yet.");
    resp(new Response("HI"));
    console.log("User now has the response.");
});

$: export default app;
```

## Register method directly (`.route[METHOD](...)`)

```ts
$: import { Wooter, c } from "jsr:@bronti/wooter";
$: const app = new Wooter();
app.route.GET(c.chemin(), async ({ resp, err }) => {
    console.log("User doesn't have response yet.");
    resp(new Response("HI"));
    console.log("User now has the response.");
});

$: export default app;
```

## Register multiple methods (`.route(path, { [METHOD]: handler })`)

```ts
$: import { Wooter, c } from "jsr:@bronti/wooter";
$: const app = new Wooter();
app.route(c.chemin(), {
    GET: async ({ resp, err }) => {
        console.log("User doesn't have response yet.");
        resp(new Response("HI"));
        console.log("User now has the response.");
    },
    POST: async ({ resp, err }) => {
        console.log("User doesn't have response yet.");
        resp(new Response("HI"));
        console.log("User now has the response.");
    },
});

$: export default app;
```

# Namespaces

Namespaces are a way to group routes together. You can use `.namespace` to create a namespace.

```ts
$: import { Wooter, c } from "jsr:@bronti/wooter";
$: const app = new Wooter();
$: app.namespace(c.chemin("api"), (api) => {
    api.route.GET(c.chemin(), async ({ resp, err }) => {
        console.log("User doesn't have response yet.");
        resp(new Response("HI"));
        console.log("User now has the response.");
    });
});
```

You can also apply middleware to a namespace by providing 2 functions, like so:

```ts
$: import { Wooter, c } from "jsr:@bronti/wooter";
$: const app = new Wooter();
$: app.namespace(
    c.chemin("api"),
    (api) => api.use(useAuth),
    (api) => {
        api.route.GET(c.chemin(), async ({ resp, err }) => {
            console.log("User doesn't have response yet.");
            resp(new Response("HI"));
            console.log("User now has the response.");
        });
    },
);
```

Namespaces can also be nested:

```ts
$: import { Wooter, c } from "jsr:@bronti/wooter";
$: const app = new Wooter();
$: app.namespace(
    c.chemin("api"),
    (api) => api.use(useAuth),
    (api) => {
        api.route.GET(c.chemin(), async ({ resp, err }) => {
            console.log("User doesn't have response yet.");
            resp(new Response("HI"));
            console.log("User now has the response.");
        });
        api.namespace(
            c.chemin("users"),
            (api) => api.use(ensureAuth),
            (users) => {
                users.route.GET(
                    c.chemin(c.pOptionalConst("me")),
                    async ({ data: { user } }) => {
                        return Response.json(user.public());
                    },
                );
            },
        );
    },
);
```

import wooter from "./demo2.ts"

const resp = await wooter.fetch(
	new Request("http://localhost/auth", {
		method: "QUERY",
		body: JSON.stringify({ username: "admin", password: "admin" }),
		headers: { "content-type": "application/json" },
	}),
)

console.log(resp)
console.log(await resp.text())

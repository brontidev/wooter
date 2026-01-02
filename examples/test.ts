import _ from "./openheart.ts"
const { fetch } = _

const response = await fetch(new Request("http://localhost:3000/example.com"))
console.log(response, await response.json())

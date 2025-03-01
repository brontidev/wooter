import { parse } from "jsr:@std/jsonc"

const [command] = Deno.args
if (command === "version") {
	console.log(parse(await Deno.readTextFile("./deno.jsonc")).version)
}

import { parse } from "@std/jsonc"
Deno.stdout.write(new TextEncoder().encode(JSON.stringify(parse(await new Response(Deno.stdin.readable).text()))))

# 🖲️ @ts-rex/wooter

[![JSR](https://jsr.io/badges/@ts-rex/wooter)](https://jsr.io/@ts-rex/wooter)
[![JSR Score](https://jsr.io/badges/@ts-rex/wooter/score)](https://jsr.io/@ts-rex/wooter)



> [!WARNING]
> wooter is WIP & beta, please do not use it for production until it reaches
> v1.0.0 **woot at your own risk!**

wooter is a simple router library written for Deno, it's inspired by Sveltekit's
router and Oak. Wooter uses [chemin](https://jsr.io/@dldc/chemin) for routing.

in the library, the route functions are defined as promises, and are provided
functions that can be used to respond to the request, or error out, rather than
throwing or returning (very useful for deno's websocket implementation).

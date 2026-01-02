import { assertEquals, assert } from "@std/assert"
import { Channel } from "@/ctx/Channel.ts"

Deno.test("Channel - creates promise", () => {
	const channel = new Channel<string>()
	assert(channel.promise instanceof Promise)
	assertEquals(channel.resolved, false)
})

Deno.test("Channel - push resolves promise", async () => {
	const channel = new Channel<string>()
	const testValue = "test value"
	
	channel.push(testValue)
	const result = await channel.promise
	
	assertEquals(result, testValue)
	assertEquals(channel.resolved, true)
})

Deno.test("Channel - multiple pushes (first one wins)", async () => {
	const channel = new Channel<number>()
	
	channel.push(42)
	channel.push(100) // Should be ignored
	
	const result = await channel.promise
	assertEquals(result, 42)
	assertEquals(channel.resolved, true)
})

Deno.test("Channel - promise can be awaited multiple times", async () => {
	const channel = new Channel<string>()
	const testValue = "hello"
	
	channel.push(testValue)
	
	const result1 = await channel.promise
	const result2 = await channel.promise
	
	assertEquals(result1, testValue)
	assertEquals(result2, testValue)
})

Deno.test("Channel - works with different types", async () => {
	const stringChannel = new Channel<string>()
	const numberChannel = new Channel<number>()
	const objectChannel = new Channel<{ foo: string }>()
	
	stringChannel.push("test")
	numberChannel.push(123)
	objectChannel.push({ foo: "bar" })
	
	assertEquals(await stringChannel.promise, "test")
	assertEquals(await numberChannel.promise, 123)
	assertEquals(await objectChannel.promise, { foo: "bar" })
})

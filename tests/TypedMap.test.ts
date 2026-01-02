import { assert, assertEquals } from "@std/assert"
import TypedMap from "@/TypedMap.ts"

Deno.test("TypedMap - constructs with empty object", () => {
	const map = new TypedMap<{}>({})
	assertEquals(map.size, 0)
})

Deno.test("TypedMap - constructs with initial data", () => {
	const map = new TypedMap<{ foo: string; bar: number }>({ foo: "hello", bar: 42 })
	assertEquals(map.size, 2)
	assertEquals(map.get("foo"), "hello")
	assertEquals(map.get("bar"), 42)
})

Deno.test("TypedMap - has() returns true for existing keys", () => {
	const map = new TypedMap<{ key: string }>({ key: "value" })
	assert(map.has("key"))
})

Deno.test("TypedMap - hasAny() returns boolean", () => {
	const map = new TypedMap<{ key: string }>({ key: "value" })
	assertEquals(map.hasAny("key"), true)
	assertEquals(map.hasAny("nonexistent" as any), false)
})

Deno.test("TypedMap - get() retrieves values", () => {
	const map = new TypedMap<{ name: string; age: number; active: boolean }>({
		name: "Alice",
		age: 30,
		active: true,
	})

	assertEquals(map.get("name"), "Alice")
	assertEquals(map.get("age"), 30)
	assertEquals(map.get("active"), true)
})

Deno.test("TypedMap - getAny() retrieves values without type checking", () => {
	const map = new TypedMap<{ key: string }>({ key: "value" })
	assertEquals(map.getAny("key"), "value")
	assertEquals(map.getAny("nonexistent"), undefined)
})

Deno.test("TypedMap - entries() returns iterator", () => {
	const map = new TypedMap<{ a: number; b: string }>({ a: 1, b: "two" })
	const entries = Array.from(map.entries())

	assertEquals(entries.length, 2)
	assert(entries.some(([k, v]) => k === "a" && v === 1))
	assert(entries.some(([k, v]) => k === "b" && v === "two"))
})

Deno.test("TypedMap - keys() returns iterator", () => {
	const map = new TypedMap<{ x: number; y: number }>({ x: 1, y: 2 })
	const keys = Array.from(map.keys())

	assertEquals(keys.length, 2)
	assert(keys.includes("x"))
	assert(keys.includes("y"))
})

Deno.test("TypedMap - values() returns iterator", () => {
	const map = new TypedMap<{ a: number; b: number }>({ a: 10, b: 20 })
	const values = Array.from(map.values())

	assertEquals(values.length, 2)
	assert(values.includes(10))
	assert(values.includes(20))
})

Deno.test("TypedMap - forEach() iterates over entries", () => {
	const map = new TypedMap<{ a: number; b: number }>({ a: 1, b: 2 })
	const collected: Array<[string | number | symbol, number]> = []

	map.forEach((value, key) => {
		collected.push([key, value])
	})

	assertEquals(collected.length, 2)
	assert(collected.some(([k, v]) => k === "a" && v === 1))
	assert(collected.some(([k, v]) => k === "b" && v === 2))
})

Deno.test("TypedMap - is iterable", () => {
	const map = new TypedMap<{ x: string; y: string }>({ x: "hello", y: "world" })
	const entries = Array.from(map)

	assertEquals(entries.length, 2)
	assert(entries.some(([k, v]) => k === "x" && v === "hello"))
	assert(entries.some(([k, v]) => k === "y" && v === "world"))
})

Deno.test("TypedMap - handles complex types", () => {
	interface ComplexData {
		user: { id: number; name: string }
		settings: { theme: string; lang: string }
	}

	const map = new TypedMap<ComplexData>({
		user: { id: 1, name: "Alice" },
		settings: { theme: "dark", lang: "en" },
	})

	assertEquals(map.get("user").id, 1)
	assertEquals(map.get("user").name, "Alice")
	assertEquals(map.get("settings").theme, "dark")
})

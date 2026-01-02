import { assertEquals, assert, assertInstanceOf } from "@std/assert"
import WooterError, { isWooterError } from "@/WooterError.ts"
import {
	HandlerDidntRespondError,
	HandlerRespondedTwiceError,
} from "@/ctx/RouteContext.ts"
import {
	MiddlewareCalledBlockBeforeNextError,
	MiddlewareHandlerDidntCallUpError,
} from "@/ctx/MiddlewareContext.ts"

Deno.test("WooterError - is an Error instance", () => {
	const error = new WooterError("test error")
	assertInstanceOf(error, Error)
	assertInstanceOf(error, WooterError)
})

Deno.test("WooterError - has error message", () => {
	const message = "Something went wrong"
	const error = new WooterError(message)
	assertEquals(error.message, message)
})

Deno.test("isWooterError - identifies WooterError instances", () => {
	const wooterError = new WooterError("test")
	const regularError = new Error("test")
	const typeError = new TypeError("test")
	
	assert(isWooterError(wooterError))
	assertEquals(isWooterError(regularError), false)
	assertEquals(isWooterError(typeError), false)
	assertEquals(isWooterError(null), false)
	assertEquals(isWooterError(undefined), false)
	assertEquals(isWooterError("error"), false)
	assertEquals(isWooterError(42), false)
})

Deno.test("HandlerDidntRespondError - extends WooterError", () => {
	const error = new HandlerDidntRespondError()
	assertInstanceOf(error, WooterError)
	assertInstanceOf(error, HandlerDidntRespondError)
	assert(isWooterError(error))
	assertEquals(error.name, "HandlerDidntRespondError")
	assertEquals(error.message, "The handler must respond before exiting")
})

Deno.test("HandlerRespondedTwiceError - extends WooterError", () => {
	const error = new HandlerRespondedTwiceError()
	assertInstanceOf(error, WooterError)
	assertInstanceOf(error, HandlerRespondedTwiceError)
	assert(isWooterError(error))
	assertEquals(error.name, "HandlerRespondedTwiceError")
	assertEquals(error.message, "The handler called resp() multiple times")
})

Deno.test("MiddlewareHandlerDidntCallUpError - extends WooterError", () => {
	const error = new MiddlewareHandlerDidntCallUpError()
	assertInstanceOf(error, WooterError)
	assertInstanceOf(error, MiddlewareHandlerDidntCallUpError)
	assert(isWooterError(error))
	assertEquals(error.name, "MiddlewareHandlerDidntCallUpError")
	assertEquals(error.message, "The middleware handler must call ctx.next() before exiting")
})

Deno.test("MiddlewareCalledBlockBeforeNextError - extends WooterError", () => {
	const error = new MiddlewareCalledBlockBeforeNextError()
	assertInstanceOf(error, WooterError)
	assertInstanceOf(error, MiddlewareCalledBlockBeforeNextError)
	assert(isWooterError(error))
	assertEquals(error.name, "MiddlewareCalledBlockBeforeNextError")
	assertEquals(error.message, "The middleware handler must call ctx.next() before being able to call ctx.block()")
})

Deno.test("All Wooter errors can be distinguished", () => {
	const errors = [
		new HandlerDidntRespondError(),
		new HandlerRespondedTwiceError(),
		new MiddlewareHandlerDidntCallUpError(),
		new MiddlewareCalledBlockBeforeNextError(),
	]
	
	// All should be WooterErrors
	errors.forEach(error => {
		assert(isWooterError(error))
	})
	
	// Each should have unique name
	const names = errors.map(e => e.name)
	const uniqueNames = new Set(names)
	assertEquals(uniqueNames.size, errors.length)
})

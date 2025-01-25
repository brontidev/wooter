export class ExitWithoutResponse extends Error {
	override name: string = "ExitWithoutResponse"
	override message: string = "App exited without responding"
}
export class MiddlewareCalledUpTooManyTimes extends Error {
	override name: string = "MiddlewareCalledUpTooManyTimes"
	override message: string = "Middleware called up() more than once"
}

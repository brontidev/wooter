/**
 * Error thrown when the route exits without responding
 */
export class ExitWithoutResponse extends Error {
	/**
	 * Error name
	 */
	override name: string = "ExitWithoutResponse"
	/**
	 * Error message
	 */
	override message: string = "Handler exited without responding"
}

/**
 * Error thrown when middleware calls up() more than once
 */
export class MiddlewareCalledUpTooManyTimes extends Error {
	/**
	 * Error name
	 */
	override name: string = "MiddlewareCalledUpTooManyTimes"
	/**
	 * Error message
	 */
	override message: string = "Middleware called up() more than once"
}

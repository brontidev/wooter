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

/**
 * Error thrown when middleware doesn't call up() or resp()
 */
export class MiddlewareDidntCallUp extends Error {
	/**
	 * Error name
	 */
	override name: string = "MiddlewareDidntCallUp"
	/**
	 * Error message
	 */
	override message: string =
		"Middleware didn't call up() or resp(), causing the app to return null"
}

/**
* Error thrown when a namespace builder is modified after it has already been locked
*/
export class LockedNamespaceBuilder extends Error {
 	/**
	 * Error name
	 */
	override name: string = "LockedNamespaceBuilder"
	/**
	 * Error message
	 */
	override message: string =
		"A Namespace was edited after it was already locked"
}

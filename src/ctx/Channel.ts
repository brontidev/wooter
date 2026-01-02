/**
 * For the purposes of wooter,
 * This is not much of a channel
 * but more of a simplified version of a promise
 */
export class Channel<T> {
	private readonly _promise: Promise<T>

	get promise(): Promise<T> {
		return this._promise
	}

	private readonly on_resolve: (value: T) => void
	private _resolved: boolean = false

	get resolved(): boolean {
		return this._resolved
	}

	constructor() {
		const { promise, resolve } = Promise.withResolvers<T>()
		this._promise = promise
		this.on_resolve = resolve
	}

	push(value: T) {
		this.on_resolve(value)
		this._resolved = true
	}
}

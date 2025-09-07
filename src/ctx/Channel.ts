/**
 * For the purposes of wooter,
 * This is not much of a channel
 * but more of a simplified version of a promise
 */
export class Channel<T> {
	protected promise: Promise<T>

	private resolve: (value: T) => void
	private _resolved: boolean = false

	get resolved(): boolean {
		return this._resolved
	}

	constructor() {
		const { promise, resolve } = Promise.withResolvers<T>()
		this.promise = promise
		this.resolve = resolve
	}

	push(value: T, _throw?: boolean) {
		if (this.resolved && _throw) {
			throw new ChannelAlreadPushedError()
		}
		this.resolve(value)
		this._resolved = true
	}

	wait(): Promise<T> {
		return this.promise
	}
}

export class ChannelAlreadPushedError {}

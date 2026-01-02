/**
 * Readonly JS map with types
 */
// deno-coverage-ignore-start This is just a wrapper of Map, and there is no implementation that needs testing.
// deno-lint-ignore no-explicit-any
export default class TypedMap<M extends Record<string, any>> {
	private readonly map: Map<keyof M, M[keyof M]>

	/**
	 * @internal
	 */
	constructor(obj?: M) {
		this.map = new Map(Object.entries(obj ?? {}))
	}

	/**
	 * indicates whether an element with the specified key exists or not.
	 * @returns boolean indicating whether an element with the specified key exists or not.
	 */
	has(key: keyof M): true {
		// @ts-ignore: If the value is not there, it is the users fault, not ours
		return this.map.has(key)
	}

	/**
	 * [ignores types]
	 *
	 * indicates whether an element with the specified key exists or not.
	 * @returns boolean indicating whether an element with the specified key exists or not.
	 */
	hasAny(key: keyof M): boolean {
		return this.map.has(key)
	}

	/** Returns an iterable of entries in the map. */
	[Symbol.iterator](): MapIterator<[keyof M, M[keyof M]]> {
		return this.map[Symbol.iterator]()
	}

	/**
	 * the number of elements in the Map.
	 */
	get size(): number {
		return this.map.size
	}
	/**
	 * Returns a specified element from the Map object. If the value that is associated to the provided key is an object, then you will get a reference to that object and any change made to that object will effectively modify it inside the Map.
	 * @returns Returns the element associated with the specified key. If no element is associated with the specified key, undefined is returned.
	 */
	get<K extends keyof M>(key: K): M[K] {
		return this.map.get(key)! as unknown as M[K]
	}

	/**
	 * Ignores types
	 * Returns a specified element from the Map object. If the value that is associated to the provided key is an object, then you will get a reference to that object and any change made to that object will effectively modify it inside the Map.
	 * @returns Returns the element associated with the specified key. If no element is associated with the specified key, undefined is returned.
	 */
	getAny(key: unknown): unknown {
		return this.map.get(key as keyof M)
	}

	/**
	 * Returns an iterable of key, value pairs for every entry in the map.
	 */
	entries(): MapIterator<[keyof M, M[keyof M]]> {
		return this.map.entries()
	}

	/**
	 * Returns an iterable of keys in the map
	 */
	keys(): MapIterator<keyof M> {
		return this.map.keys()
	}

	/**
	 * Returns an iterable of values in the map
	 */
	values(): MapIterator<M[keyof M]> {
		return this.map.values()
	}

	/**
	 * Executes a provided function once per each key/value pair in the Map, in insertion order.
	 */
	forEach(callback: (value: M[keyof M], key: keyof M, map: Map<keyof M, M[keyof M]>) => void): void {
		this.map.forEach(callback)
	}
}
// deno-coverage-ignore-stop

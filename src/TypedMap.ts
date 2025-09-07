// deno-lint-ignore no-explicit-any
export default class TypedMap<M extends Record<string, any>> extends Map<keyof M, M[keyof M]> {
    override get<K extends keyof M>(key: K): M[K] {
        return super.get(key)!;
    }

    override set<K extends keyof M>(key: K, value: M[K]): this {
        return super.set(key, value);
    }
}

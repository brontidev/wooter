export type PromiseState = "pending" | "fulfilled" | "rejected"

export interface Resolvers<T> {
    state: PromiseState,
    promise: Promise<T>,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
}

export function createResolvers<T>(): Resolvers<T> {
    let state: PromiseState = "pending"
    const { promise, reject, resolve } = Promise.withResolvers<T>()
    return {
        state,
        promise,
        reject() {
            reject(...arguments)
            if(state !== "pending") return // if the promise had already been resolved, the state won't end up internally changing anyway
            state = 'rejected'
        },
        resolve() {
            resolve(...arguments)
            if(state !== "pending") return // if the promise had already been resolved, the state won't end up changing internally anyway
            state = 'fulfilled'
        }
    }
}
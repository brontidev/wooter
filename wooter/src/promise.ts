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

    const updateState = (newState: PromiseState) => {
        if (state !== "pending") return // if the promise had already been resolved, the state won't end up internally changing anyway
        state = newState
    }

    return {
        state,
        promise,
        reject() {
            updateState('rejected')
            reject(...arguments)
        },
        resolve() {
            updateState('rejected')
            resolve(...arguments)
        }
    }
}
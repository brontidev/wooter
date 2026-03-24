import { AsyncLocalStorage } from "node:async_hooks"

export const Wooter__catchStrayErrorsStore = new AsyncLocalStorage<(e: unknown) => void>()
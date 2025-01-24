export class Event<TParams extends Record<string, unknown> = Record<string, unknown>, TData extends Record<string, unknown> = Record<string, unknown>> {
    private resolvers: PromiseWithResolvers<Response>

    get resp() {
        return this.resolvers.resolve
    }

    get err() {
        return this.resolvers.reject
    }

    get promise() {
        return this.resolvers.promise
    }

    get request() {
        return this._request
    }

    get params() {
        return this._params
    }

    get data() {
        return this._data
    }

    constructor(private _request: Request, private _params: TParams, private _data: TData) {
        this.resolvers = Promise.withResolvers()
    }
}

export class MiddlewareEvent extends Event {
    
}
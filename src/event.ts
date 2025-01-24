export default class Event {
    get request() {
        return this._request
    }

    constructor(private _request: Request) {}
}
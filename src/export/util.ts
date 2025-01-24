/**
 * Copyright (c) 2020 [sveltekit contributors](https://github.com/sveltejs/kit/graphs/contributors)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

//jsonResponse, redirectResponse, fixLocation, errorResponse

/**
 * Returns a JSON `Response` given a stringifiable object
 * @param json {any}
 * @param init {ResponseInit}
 */
export function jsonResponse(json: unknown, init?: ResponseInit) {
    const body = JSON.stringify(json)
    const headers = new Headers(init?.headers)

    if (!headers.has('content-length')) headers.set('content-length', encoder.encode(body).byteLength.toString())
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');

    return new Response(body, {
        ...init,
        headers
    });
}

export function redirectResponse() {
    
}

const encoder = new TextEncoder();
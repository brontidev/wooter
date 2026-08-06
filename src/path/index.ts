import { match } from "./match.ts"
import { matcher, single, wrap } from "./matcher.ts"
import type { Matcher, Param, Path } from "./types.ts"

export const path = <const TPath extends Path>(...path: TPath): TPath => path
export function p<Name extends string>(name: Name): Param<Name, string>
export function p<Name extends string, T>(name: Name, matcher: Matcher<T, undefined>): Param<Name, T, undefined>
export function p<Name extends string, T, Options>(name: Name, matcher: Matcher<T, Options>, options: Options): Param<Name, T, Options>
export function p(name: string, matcher?: Matcher<any, any>, options?: any): any {
    return matcher ? { name, matcher, options } as const : { name } as const
}

export const num = single<number>(function num(seg) {
    const value = Number(seg)
    if (isNaN(value)) return { ok: false }
    return { ok: true, value }
})

// const _constant = single<string, string>((seg, opt) => seg == opt ? { ok: true, value: seg } : { ok: false })
// export const constant = (constant: string) => {
//     return p<never>(undefined as unknown as string, _constant, constant)
// }

export function multiple<T, Opt>(matcher: Matcher<T, Opt>, at_least_one = false): Matcher<T[], Opt> {
    return wrap<T[], Opt>((path, i, opt) => {
        let consume = 0
        const value = []

        while(true) {
            const result = matcher(path, i, opt)
            if(result.ok) {
                value.push(result.value)
                i += result.consume
                consume += result.consume
                continue
            }
            break
        }

        if(consume == 0 && at_least_one) return { ok: false }
        return { ok: true, consume, value }
    }, matcher.name, name => name + (at_least_one ? '+' : '*'))
}

export function optional<T, Opt>(matcher: Matcher<T, Opt>): Matcher<T | undefined, Opt> {
    return wrap<T | undefined, Opt>((path, i, opt) => {
        const result = matcher(path, i, opt)
        return result.ok ? result : { ok: true, value: undefined, consume: 0 }
    }, matcher.name, name => `${name}?`)
}
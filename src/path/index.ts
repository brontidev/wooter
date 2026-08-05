type MiniOption<T> = { ok: false } | ({ ok: true } & T)

const _KIND = Symbol('wooter.param.kind')

type SingleMatcherFn<Value, Opt = undefined> = (seg: string, opt: Opt) => MiniOption<{ value: Value }>
type SingleMatcher<Value, Opt = undefined> = { [_KIND]: 1, name?: string } & SingleMatcherFn<Value, Opt>

type SpanMatcherFn<Value, Opt = undefined> = (segs: string[], opt: Opt) => MiniOption<{ value: Value, consumed: number }> 
type SpanMatcher<Value, Opt = undefined> = { [_KIND]: 2, name?: string } & SpanMatcherFn<Value, Opt>

type Matcher<Value, Opt = undefined> = SingleMatcher<Value, Opt> | SpanMatcher<Value, Opt>

const matcher = {
    single<T, Opt = undefined>(matcher: SingleMatcherFn<T, Opt>, name?: string): SingleMatcher<T, Opt> {
        return Object.assign(matcher, { [_KIND]: 1, name } as const)
    },
    span<T, Opt = undefined>(matcher: SpanMatcherFn<T, Opt>, name?: string): SpanMatcher<T, Opt> {
        return Object.assign(matcher, { [_KIND]: 2, name } as const)
    }
}

type PathParam<Name extends string = string, Value = string, Opt = undefined> =
    | [name: Name]
    | [name: Name, matcher: Matcher<Value, Opt>]
    | [name: Name, matcher: Matcher<Value, Opt>, opt: Opt]

type Path = (string | PathParam)[]

const num = matcher.single((seg) => {
    const value = Number(seg)
    return isNaN(value) ? { ok: false } : { ok: true, value }
})

const rest = matcher.span((segs) => {
    return { ok: true, value: segs, consumed: segs.length }
})

function p<Name extends string>(name: Name): PathParam<Name>
function p<Name extends string, T>(name: Name, matcher: Matcher<T, undefined>): PathParam<Name, T>
function p<Name extends string, T, Opt>(name: Name, matcher: Matcher<T, Opt>, opt: Opt): PathParam<Name, T, Opt>
function p(...param: unknown[]): unknown {
    return param
}

function path(...path: Path): Path {
    return path
}

function match(pattern: Path, path: string): MiniOption<{ value: Record<string, unknown> }> {
    const out: Record<string, unknown> = {}
    const segs = path.split('/')
    let i = 0;
    for (const step of pattern) {
        if(i >= segs.length) return { ok: false }
        if(typeof step == 'string') {
            if(segs[i] !== step) return { ok: false }
            i++;
            continue
        }

        const [name, matcher, options] = step

        if(matcher === undefined) {
            out[name] = segs[i]
            i++;
            continue
        }
        
        let arg_one: string | string[];

        if(matcher[_KIND] == 1) {
            arg_one = segs[i]
        } else if(matcher[_KIND] == 2) {
            arg_one = segs.slice(i)
        } else {
            continue
        }

        const result = matcher(arg_one, options)
        if(!result.ok) return { ok: false }
        i += result.consumed ?? 1
        out[name] = result.value
    }
    return { ok: true, value: out }
}
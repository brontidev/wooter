import type { ParamsOfPath, Path } from "@/path/types.ts"

export function match<const TPath extends Path>(segments: string[], i: number, pattern: TPath, exact: true): { match: false } | { match: true, params: ParamsOfPath<TPath> }
export function match<const TPath extends Path>(segments: string[], i: number, pattern: TPath, exact: false): { match: false } | { match: true, params: ParamsOfPath<TPath>, stopped_at: number }
export function match(segments: string[], i: number, pattern: Path, exact: boolean): { match: false } | { match: true, params: ParamsOfPath<Path>, stopped_at?: number } {
    const params: Record<string, unknown> = {}

    for (const patternElement of pattern) {
        if (typeof patternElement == 'string') {
            if (i >= segments.length || segments[i] != patternElement) return { match: false }
            i++
            continue
        }
        if (!('matcher' in patternElement)) {
            if (i >= segments.length) return { match: false }
            params[patternElement.name] = segments[i]
            i++
            continue
        }

        const result = patternElement.matcher(segments, i, patternElement.options)
        if (result.ok) {
            params[patternElement.name] = result.value
            i += result.consume
            continue
        }

        return { match: false }
    }

    if (i < segments.length && exact) return { match: false }

    return { match: true, params, stopped_at: i }
}

export function stringify(path: Path): string {
    const strs = [];
    for (const patternElement of path) {
        if (typeof patternElement == 'string') {
            strs.push(patternElement)
            continue
        }
        if ('matcher' in patternElement && patternElement.matcher.name) {
            strs.push(`:${patternElement.name}(${patternElement.matcher.name})`)
            continue
        }
        strs.push(`:${patternElement.name}`)
    }
    strs.unshift('')
    return strs.join('/')
}

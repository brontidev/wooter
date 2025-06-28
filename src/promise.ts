import { Result } from "@oxi/result"

export function promiseResult<T>(fn: () => Promise<T>): Promise<Result<T, unknown>> {
    return fn().then(
        (value) => Result.Ok(value),
        (error) => Result.Err(error)
    );
}

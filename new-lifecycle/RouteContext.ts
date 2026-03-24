import { pair, Soon, SoonReader, SoonWriter } from "@bronti/robust/Soon"
import { err, ok, Result } from "@bronti/wooter/result"
import { some, none, Option } from "@bronti/wooter/option"

type Executable<T, Args extends unknown[]> = (write: SoonWriter<T>, ...args: Args) => Promise<void> | void

function run<T, Args extends unknown[] = unknown[]>(exec: Executable<T, Args>, args: Args, catchStray: (e: unknown) => void): SoonReader<Result<Option<T>, unknown>> {
	const [r_result, t_result] = pair<Result<Option<T>, unknown>>()

	const [r_execution, t_execution] = pair<Result<null, unknown>>()
	const [r_value, t_value] = pair<T>()

	Promise.try(exec, t_value, ...args)
		.then(() => {
			t_execution.push(ok(null))
		}, (e) => {
			t_execution.push(err(e))
		})

	r_value.then((v) => {
        if(r_execution.resolved) console.warn("responding after execution is misuse of the library")
		t_result.push(ok(some(v)))
	})
	r_execution.then((v) => {
		if (v.isOk()) return t_result.push(ok(none()))

		const e = v.unwrapErr()
		if (r_value.resolved) return catchStray(e)
		return t_result.push(err(e))  
	})

	return r_result
}

const v = await run((v: SoonWriter<number>, a: number, b: number) => {
    setTimeout(() => v.push(0), 400)
}, [1, 2], (e) => {
    console.log('found stray error: ', e)
})

console.log(v)
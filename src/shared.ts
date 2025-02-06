export function promiseResolved(p: Promise<unknown>): Promise<boolean> {
	const t = {}
	return Promise.race([p, t])
		.then(
			(v) => (v === t) ? false : true,
		)
}

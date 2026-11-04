/**
 * Wraps `compute` so it runs again only for a text other than the last one it was given, and
 * otherwise returns the last result. Every caller gets that same result, so none may change it.
 */
export function rememberLast<T>(compute: (text: string) => T): (text: string) => T {
	let last: { text: string; result: T } | null = null;
	return (text) => {
		if (last === null || last.text !== text) last = { text, result: compute(text) };
		return last.result;
	};
}

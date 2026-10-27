/** The clicked text and character, or `at: null` on a drawn part, with `index` the texts before it. */
export interface RenderedClick {
	index: number;
	at: number | null;
}

// Each rendered text is looked for after the one before it, which steps over markup in order. The
// caret goes on the clicked character where its text is found, else at the end of that source line.
export function sourceCaret(source: string, texts: readonly string[], click: RenderedClick): number {
	let from = 0;
	for (const text of texts.slice(0, click.index)) {
		// Whitespace between blocks would match the next line break, past the text it stands between.
		if (text.trim() === '') continue;
		const found = source.indexOf(text, from);
		if (found >= 0) from = found + text.length;
	}
	if (click.at === null) return lineEnd(source, nextVisible(source, from));
	const found = source.indexOf(texts[click.index] ?? '', from);
	return found >= 0 ? found + click.at : lineEnd(source, nextVisible(source, from));
}

function nextVisible(source: string, from: number): number {
	const skipped = source.slice(from).search(/\S/);
	return skipped < 0 ? source.length : from + skipped;
}

function lineEnd(source: string, at: number): number {
	const end = source.indexOf('\n', at);
	return end < 0 ? source.length : end;
}

/** Where a match starts and ends in a string, end exclusive. */
export type Span = readonly [from: number, to: number];

/** One word's search: its matches in `text`, or null when it finds none. It may report only the first. */
export type WordSearch = (text: string) => readonly Span[] | null;

/** The words of a Find query, each searched for alone: its space-separated words, as Obsidian's simple search reads them. */
export function queryWords(query: string): string[] {
	return query.split(' ').filter((word) => word !== '');
}

/** Every place in `text` any of `words` matches, in text order, with spans that overlap or touch merged. */
export function findSpans(text: string, words: readonly WordSearch[]): Span[] {
	const spans: Span[] = [];
	for (const search of words) {
		let at = 0;
		for (;;) {
			const matches = search(text.slice(at));
			const last = matches?.[matches.length - 1];
			if (!matches || !last || last[1] <= 0) break;
			for (const [from, to] of matches) spans.push([at + from, at + to]);
			at += last[1];
		}
	}
	return merged(spans);
}

function merged(spans: Span[]): Span[] {
	const sorted = [...spans].sort((a, b) => a[0] - b[0]);
	const result: [number, number][] = [];
	for (const [from, to] of sorted) {
		const last = result[result.length - 1];
		if (last && from <= last[1]) last[1] = Math.max(last[1], to);
		else result.push([from, to]);
	}
	return result;
}

/** The text of one text node, and the number of the block element it's in. */
export interface TextPiece {
	text: string;
	block: number;
}

/** A place in a list of pieces: which piece, and how far into its text. */
export interface PiecePoint {
	piece: number;
	offset: number;
}

/**
 * Where `words` match in the pieces' text, read as shown: the pieces of one block are joined as
 * they are, and a line break goes between blocks, so a match never runs from one into the next.
 */
export function pieceSpans(
	pieces: readonly TextPiece[],
	words: readonly WordSearch[],
): { start: PiecePoint; end: PiecePoint }[] {
	const starts: number[] = [];
	let text = '';
	pieces.forEach((piece, i) => {
		if (i > 0 && piece.block !== pieces[i - 1]?.block) text += '\n';
		starts.push(text.length);
		text += piece.text;
	});
	const pointAt = (at: number, isEnd: boolean): PiecePoint => {
		let piece = 0;
		for (let i = 0; i < pieces.length; i++) {
			const start = starts[i] ?? 0;
			const end = start + (pieces[i]?.text.length ?? 0);
			if (isEnd ? at > start && at <= end : at >= start && at < end) {
				piece = i;
				break;
			}
		}
		return { piece, offset: at - (starts[piece] ?? 0) };
	};
	return findSpans(text, words).map(([from, to]) => ({ start: pointAt(from, false), end: pointAt(to, true) }));
}

/** A `[[…]]` link, or a `![[…]]` embed, in a line: its columns [from, to) and its parts. */
export interface WikiLink {
	from: number;
	to: number;
	/** The part before the first `|`, heading or block reference included. */
	linkpath: string;
	/** The part after the first `|`, or null without one. */
	display: string | null;
	embed: boolean;
}

const WIKI_LINK = /(!?)\[\[([^[\]]+)\]\]/g;

/**
 * Every wikilink and wiki embed in `text`, one line, in order. The Markdown parser has no wikilinks,
 * so this finds them wherever they are, in code too.
 */
export function wikiLinks(text: string): WikiLink[] {
	return Array.from(text.matchAll(WIKI_LINK), (match) => {
		const inner = match[2] ?? '';
		const bar = inner.indexOf('|');
		return {
			from: match.index,
			to: match.index + match[0].length,
			linkpath: bar < 0 ? inner : inner.slice(0, bar),
			display: bar < 0 ? null : inner.slice(bar + 1),
			embed: match[1] === '!',
		};
	});
}

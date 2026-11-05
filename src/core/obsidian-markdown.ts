import { GFM, parser, type BlockParser, type DelimiterType, type InlineContext, type InlineParser, type Line, type MarkdownConfig } from '@lezer/markdown';

const EQUALS = 61;
const DOLLAR = 36;
const BANG = 33;
const BRACKET = 91;
const PERCENT = 37;
const HIGHLIGHT_DELIMITER: DelimiterType = { resolve: 'Highlight', mark: 'HighlightMark' };

const isSpace = (char: string) => /\s|^$/.test(char);

const highlight: InlineParser = {
	name: 'Highlight',
	parse(cx, next, pos) {
		if (next !== EQUALS || cx.char(pos + 1) !== EQUALS || cx.char(pos + 2) === EQUALS) return -1;
		return cx.addDelimiter(HIGHLIGHT_DELIMITER, pos, pos + 2, !isSpace(cx.slice(pos + 2, pos + 3)), !isSpace(cx.slice(pos - 1, pos)));
	},
	after: 'Emphasis',
};

// A wikilink or embed, taken whole so nothing in its target or alias reads as Markdown.
const wikiLink: InlineParser = {
	name: 'WikiLink',
	parse(cx, next, pos) {
		const open = next === BANG ? pos + 1 : pos;
		if (cx.char(open) !== BRACKET || cx.char(open + 1) !== BRACKET) return -1;
		return addOpaque(cx, 'WikiLink', pos, cx.slice(open, cx.end).indexOf(']]', 2), open, 2);
	},
	before: 'Link',
};

// $math$ as Obsidian reads it: no space just inside either `$`, and an escaped `\$` inside doesn't close it.
const inlineMath: InlineParser = {
	name: 'InlineMath',
	parse(cx, next, pos) {
		if (next !== DOLLAR) return -1;
		if (cx.char(pos + 1) === DOLLAR) return addOpaque(cx, 'InlineMath', pos, cx.slice(pos, cx.end).indexOf('$$', 2), pos, 2);
		if (isSpace(cx.slice(pos + 1, pos + 2))) return -1;
		const rest = cx.slice(pos, cx.end);
		let close = rest.indexOf('$', 2);
		while (close > 0 && (isSpace(rest.charAt(close - 1)) || rest.charAt(close - 1) === '\\')) close = rest.indexOf('$', close + 1);
		return addOpaque(cx, 'InlineMath', pos, close, pos, 1);
	},
	before: 'Emphasis',
};

const inlineComment: InlineParser = {
	name: 'InlineComment',
	parse(cx, next, pos) {
		if (next !== PERCENT || cx.char(pos + 1) !== PERCENT) return -1;
		return addOpaque(cx, 'InlineComment', pos, cx.slice(pos, cx.end).indexOf('%%', 2), pos, 2);
	},
	before: 'Emphasis',
};

// An element from `from` to the closing delimiter found `close` characters after `base`, if found.
function addOpaque(cx: InlineContext, name: string, from: number, close: number, base: number, closeLength: number): number {
	return close < 0 ? -1 : cx.addElement(cx.elt(name, from, base + close + closeLength));
}

/**
 * A $$ math block or %% comment block, taken whole: as the list's parse reads them, a line whose text
 * starts with the delimiter at its first column opens one, unless it closes it too, and the next line
 * holding it closes it.
 */
function delimitedBlock(name: string, delimiter: string): BlockParser {
	const opens = (line: Line) => line.text.startsWith(delimiter);
	return {
		name,
		parse(cx, line) {
			if (!opens(line)) return false;
			const from = cx.lineStart;
			let to = cx.lineStart + line.text.length;
			if (!line.text.includes(delimiter, delimiter.length)) {
				while (cx.nextLine()) {
					to = cx.lineStart + line.text.length;
					if (line.text.includes(delimiter)) break;
				}
			}
			cx.nextLine();
			cx.addElement(cx.elt(name, from, to));
			return true;
		},
		endLeaf: (_cx, line) => opens(line),
		before: 'FencedCode',
	};
}

const OBSIDIAN: MarkdownConfig = {
	defineNodes: ['Highlight', 'HighlightMark', 'WikiLink', 'InlineMath', 'InlineComment', 'MathBlock', 'CommentBlock'],
	parseInline: [highlight, wikiLink, inlineMath, inlineComment],
	parseBlock: [delimitedBlock('MathBlock', '$$'), delimitedBlock('CommentBlock', '%%')],
};

/** CommonMark and GFM, as @lezer/markdown reads them, with the inline and block syntax Obsidian adds. */
export const obsidianMarkdown = parser.configure([GFM, OBSIDIAN]);

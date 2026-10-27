import { MARKER_KEY } from '../constants';
import { dominantEol, joinLines, type Line, spliceLines, splitLines } from './lines';

export interface FrontmatterShape {
	closingLine: number;
	isMapping: boolean;
}

export interface MarkerEdit {
	start: number;
	deleteCount: number;
	insert: string[];
}

export type MarkerRefusal = { refused: 'not-a-mapping' | 'multiline-value' };

const MARKER_LINE = `${MARKER_KEY}: true`;
// The key as YAML may write it: plain or quoted, with spaces before the colon.
const KEY_LINE = new RegExp(`^(?:${MARKER_KEY}|"${MARKER_KEY}"|'${MARKER_KEY}')[ \\t]*:(.*)$`);
// A block scalar header such as `|`, `>-`, `|+` or `|2`, optionally followed by a comment.
const BLOCK_SCALAR = /^\s*[|>][-+0-9]*\s*(#.*)?$/;

export function planMarker(text: string, frontmatter: FrontmatterShape | null): MarkerEdit | MarkerRefusal {
	if (!frontmatter) return { start: 0, deleteCount: 0, insert: ['---', MARKER_LINE, '---'] };
	if (!frontmatter.isMapping) return { refused: 'not-a-mapping' };
	const lines = splitLines(text);
	for (let i = 1; i < frontmatter.closingLine; i++) {
		const value = KEY_LINE.exec((lines[i] as Line).text)?.[1];
		if (value === undefined) continue;
		if (runsOverSeveralLines(value, lines[i + 1]?.text ?? '', i + 1 < frontmatter.closingLine)) {
			return { refused: 'multiline-value' };
		}
		return { start: i, deleteCount: 1, insert: [MARKER_LINE] };
	}
	return { start: frontmatter.closingLine, deleteCount: 0, insert: [MARKER_LINE] };
}

// An indented next line continues any value, a flow list or a quoted string as much as a block. A
// `- ` line continues only a value left empty.
function runsOverSeveralLines(value: string, next: string, nextIsInside: boolean): boolean {
	if (BLOCK_SCALAR.test(value)) return true;
	if (!nextIsInside) return false;
	return /^[ \t]/.test(next) || (value.trim() === '' && next.startsWith('- '));
}

// A line that replaces another keeps that line's ending; new lines take the file's usual one.
export function applyMarkerEdit(text: string, edit: MarkerEdit): string {
	const lines = splitLines(text);
	const eol = dominantEol(lines);
	const insert = edit.insert.map((lineText, i): Line => {
		const replaced = i < edit.deleteCount ? lines[edit.start + i] : undefined;
		return { text: lineText, eol: replaced?.eol || eol };
	});
	return joinLines(spliceLines(lines, edit.start, edit.deleteCount, insert));
}

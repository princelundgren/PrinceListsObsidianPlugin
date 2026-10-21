import { readdirSync, readFileSync } from 'node:fs';
import { HtmlRenderer, Parser, type Node } from 'commonmark';
import { expect } from 'vitest';
import { splitLines, type Line } from '../../src/core/lines';
import { isBlank, maskBlocks, parseList, type ItemBlock, type Section } from '../../src/core/parse';

export const FIXTURES = readdirSync(new URL('../fixtures/', import.meta.url));
export const readFixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

// Content starts after the frontmatter's closing ---, when there is frontmatter.
export const contentStartOf = (lines: Line[]) =>
	lines[0]?.text === '---' ? lines.findIndex((line, i) => i > 0 && line.text === '---') + 1 : 0;

export function list(text: string) {
	const lines = splitLines(text);
	const model = parseList(lines, contentStartOf(lines));
	const items = model.sections.flatMap((s) => s.items);
	const item = (n: number) => items[n] as ItemBlock;
	const section = (n: number) => model.sections[n] as Section;
	return { lines, model, items, item, section };
}

export const html = (text: string) => new HtmlRenderer().render(new Parser().parse(text));

// The same text with CRLF endings.
export const crlf = (text: string) => text.replace(/\n/g, '\r\n');

// Cases where an edit can leave text below an item or a paragraph that would join it, or turn a
// paragraph into a setext heading, which an empty line fixes; and fenceUnderNote, which looks the
// same but joins nothing, so it must get no empty line.
export const JOINING_CASES = {
	fenceThenText: '## G\n- [ ] z\n- [ ] a\n\n\t```\n\tx\n\t```\nText\n## K\n- [ ] c\n',
	codeThenText: '## G\n- [ ] z\n- [ ] a\n\n\t\tcode\nText\n## K\n- [ ] c\n',
	setextTitleThenText: '## G\n- [ ] z\n- [ ] a\n\t---\nText\n## K\n- [ ] c\n',
	setextHeadingTop: 'Note\n\nKitchen\n---\n- [ ] a\n',
	setextHeadingTop2: '---\nprincelists: true\n---\nNote\n\nKitchen\n=======\n- [ ] a\n\nHall\n---\n- [ ] b\n',
	gapsBothLast: '## G\n- [ ] a\n\n- [ ] b\n\n## K\n- [ ] c\n',
	sameSectionSlotText: '- [ ] a\n\n\t```\n\tx\n\t```\nText\n\n- [ ] b\n',
	sameSectionFence: '- [ ] b\n- [ ] a\n\n\t```\n\tx\n\t```\nText\n',
	untouchedBlocks: '## G\n- [ ] a\n```\ncode\n```\n- [ ] b\n> quote\n- [ ] c\n## K\n- [ ] d\n',
	tableAfter: '## G\n- [ ] a\n\n| a | b |\n| - | - |\n- [ ] b\n## K\n- [ ] d\n',
	firstItemNoGapBeforeText: '## G\nText\n- [ ] a\n\n- [ ] b\n## K\n- [ ] d\n',
	hrUnderListNote: '---\nprincelists: true\n---\nShopping for the weekend\n- [ ] milk\n---\n- [ ] bread\n',
	hrUnderNote: 'Note\n- [ ] a\n---\n- [ ] b\n',
	hrUnderUntouched: '## G\n- [ ] z\n\nU\n- [ ] a\n---\n- [ ] b\n',
	equalsUnderNote: 'Note\n- [ ] a\n\n\t```\n\tx\n\t```\n===\n',
	fenceUnderNote: 'Note\n- [ ] a\n```\ncode\n```\n- [ ] b\n',
	quoteLazy: '> q\n- [ ] a\n\n\t```\n\tx\n\t```\nText\n',
};

// Cases where some edits can't keep the rest parsing as it did, even with an empty line, and so are
// refused: text indented to an item's content column, and a <div> that ends only at a blank line.
export const REFUSED_CASES = {
	widerColumnDelete: '- [ ] z\n1. [ ] a\n\n   ```\n   x\n   ```\n  Text\n',
	widerColumnMove: '## G\n- [ ] z\n## K\n1. [ ] c\n\n   ```\n   x\n   ```\n  Text\n',
	divInEmptySection: '## H\n<div>\nx\n</div>\n\n## K\n- [ ] a\n',
};

// Every top-level CommonMark block, each list split into its items, as its type and source text.
// Built here from commonmark directly, apart from the code under test.
export function blocks(text: string): string[] {
	return sourceBlocks(text)
		.map((b) => b.block)
		.sort();
}

// The top-level block that holds `line`, as its type and source text, and where it starts and ends.
export const blockAt = (text: string, line: number) => sourceBlocks(text).find((b) => b.start <= line && line < b.end);

function sourceBlocks(text: string): { block: string; start: number; end: number }[] {
	const lines = splitLines(text);
	const contentStart = contentStartOf(lines);
	const doc = new Parser().parse(maskBlocks(lines, contentStart).text);
	const out: { block: string; start: number; end: number }[] = [];
	for (let block: Node | null = doc.firstChild; block; block = block.next) {
		const nodes: Node[] = [];
		if (block.type === 'list') for (let item = block.firstChild; item; item = item.next) nodes.push(item);
		else nodes.push(block);
		for (const node of nodes) {
			const start = contentStart + node.sourcepos[0][0] - 1;
			let end = Math.min(lines.length, contentStart + node.sourcepos[1][0]);
			while (end > start && isBlank((lines[end - 1] as Line).text)) end--;
			out.push({ block: `${node.type}:${lines.slice(start, end).map((line) => line.text).join('\n')}`, start, end });
		}
	}
	return out;
}

// An edit replaces one run of lines: the lines before it keep their text, and the lines after it
// shift. Only the endings at the end of the file can change, which spliceLines' own tests cover.
export function expectLinesBeforeKept(before: readonly Line[], after: readonly Line[], runStart: number) {
	expect(after.slice(0, runStart).map((line) => line.text)).toEqual(before.slice(0, runStart).map((line) => line.text));
}

export function expectLinesAfterKept(before: readonly Line[], after: readonly Line[], runEnd: number) {
	const kept = before.length - runEnd;
	expect(after.slice(after.length - kept).map((line) => line.text)).toEqual(before.slice(runEnd).map((line) => line.text));
}

export const itemBlock = (lines: readonly Line[], item: ItemBlock) =>
	`item:${lines.slice(item.titleLine, item.endLine).map((line) => line.text).join('\n')}`;

// Every block the edit didn't remove or add parses as it did, with the same type and source text.
export function expectRestKept(before: string, after: string, edit: { removed?: string[]; added?: string[] } = {}) {
	const expected = blocks(before);
	for (const block of edit.removed ?? []) {
		expect(expected).toContain(block);
		expected.splice(expected.indexOf(block), 1);
	}
	expect(blocks(after)).toEqual([...expected, ...(edit.added ?? [])].sort());
}

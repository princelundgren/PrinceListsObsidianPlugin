import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { splitLines } from '../../src/core/lines';
import { maskBlocks, parseList, topLevelBlocks } from '../../src/core/parse';

const readFixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
const fixture = (name: string) => splitLines(readFixture(name));
const parse = (text: string, contentStart = 0) => parseList(splitLines(text), contentStart);
const item = (titleLine: number, endLine: number, notesIndent = '\t') => ({ titleLine, endLine, notesIndent });

test('finds the list note, sections and items of the design example', () => {
	const lines = fixture('example.md');
	expect(parseList(lines, 3)).toEqual({
		contentStart: 3,
		listNote: { start: 3, end: 4 },
		sections: [
			{ headingLine: null, items: [item(5, 6)], endLine: 6 },
			{ headingLine: 7, items: [item(8, 9), item(9, 17), item(17, 18)], endLine: 18 },
			{ headingLine: 19, items: [item(20, 21)], endLine: 21 },
		],
		untouched: [],
	});
	expect(lines[3]?.text).toMatch(/^Stuff for the new apartment/);
	expect(lines[9]?.text).toMatch(/^- \[ \] freezer storage boxes/);
	expect(lines[16]?.text).toBe('\t![[storage-box.jpg]]');
});

test('reads the example with CRLF endings the same way', () => {
	const crlf = splitLines(readFixture('example.md').replace(/\n/g, '\r\n'));
	expect(crlf[0]?.eol).toBe('\r\n');
	expect(parseList(crlf, 3)).toEqual(parseList(fixture('example.md'), 3));
});

test('keeps every kind of Markdown in the notes inside the item', () => {
	const lines = fixture('notes-everything.md');
	expect(lines).toHaveLength(19);
	expect(parseList(lines, 0)).toEqual({
		contentStart: 0,
		listNote: { start: 0, end: 0 },
		sections: [{ headingLine: null, items: [item(0, 19)], endLine: 19 }],
		untouched: [],
	});
});

test('never takes an item from a top-level block that holds checkbox lines', () => {
	const model = parseList(fixture('top-level-untouched.md'), 0);
	expect(model.sections).toEqual([{ headingLine: null, items: [item(0, 1), item(24, 25)], endLine: 25 }]);
	expect(model.untouched).toEqual([
		{ start: 2, end: 5 },
		{ start: 6, end: 9 },
		{ start: 10, end: 13 },
		{ start: 14, end: 17 },
		{ start: 18, end: 21 },
		{ start: 22, end: 23 },
	]);
});

test('accepts every marker and checkbox character, and indents notes to a wide content column', () => {
	const items = parseList(fixture('markers.md'), 0).sections[0]?.items;
	expect(items).toEqual([
		item(0, 1),
		item(1, 2),
		item(2, 3),
		item(3, 4),
		item(4, 5),
		item(5, 6),
		item(6, 7, '     '),
	]);
	// A tab after `100.` moves to column 8, not 5.
	expect(parse('100.\t[ ] x\n').sections[0]?.items).toEqual([item(0, 1, ' '.repeat(8))]);
});

test('keeps a lazy line in its item and indents new notes to the content column', () => {
	expect(parseList(fixture('lazy.md'), 0).sections[0]?.items).toEqual([item(0, 2), item(2, 3)]);
	expect(parse('- [ ] c\n lazy\n').sections[0]?.items).toEqual([item(0, 2)]);
	expect(parse('100. [ ] x\n\tlazy\n').sections[0]?.items).toEqual([item(0, 2, '     ')]);
});

test('topLevelBlocks splits lists into items, masks %% regions and ends blocks before blank lines', () => {
	const lines = splitLines('---\nx: 1\n---\nNote\n\n- [ ] a\n\n\tn\n- b\n## H\n%%\n- [ ] y\n%%\n\n');
	expect(topLevelBlocks(lines, 3)).toEqual([
		{ type: 'paragraph', start: 3, end: 4 },
		{ type: 'item', start: 5, end: 8 },
		{ type: 'item', start: 8, end: 9 },
		{ type: 'heading', start: 9, end: 10 },
		{ type: 'code_block', start: 10, end: 13 },
	]);
});

test('notes that open with indented code take the content-column indent, not the code indent', () => {
	expect(parse('- [ ] a\n\n\t\tcode\n\n\tpara\n').sections[0]?.items).toEqual([item(0, 5)]);
	expect(parse('- [ ] a\n\n      code\n\n    para\n').sections[0]?.items).toEqual([item(0, 5)]);
	expect(parse('- [ ] a\n\n     five\n').sections[0]?.items).toEqual([item(0, 3, '     ')]);
	expect(parse('100. [ ] x\n\n         code\n').sections[0]?.items).toEqual([item(0, 3, ' '.repeat(5))]);
});

test('notes that reach the content column exactly keep their indent, and column 4 takes a tab', () => {
	expect(parse('- [ ] a\n\n  note\n').sections[0]?.items).toEqual([item(0, 3, '  ')]);
	expect(parse('10. [ ] x\n').sections[0]?.items).toEqual([item(0, 1)]);
});

test('a title that CommonMark turns into a heading is still an item', () => {
	const model = parseList(fixture('title-heading.md'), 0);
	expect(model.sections).toEqual([{ headingLine: null, items: [item(0, 2), item(2, 3)], endLine: 3 }]);
});

test('ends an item before trailing blank lines, counting a spaces-only line as blank', () => {
	const text = readFixture('trailing-whitespace.md');
	expect(text).toBe('- [ ] a  \n\n\tnote \t\n  \n- [ ] b\t\n');
	expect(parse(text).sections[0]?.items).toEqual([item(0, 3), item(4, 5)]);
});

test('ends an item before trailing blank lines when its notes leave a block open', () => {
	// CommonMark closes the open block where the item ends, so its range takes in the blank lines.
	expect(parse('- [ ] a\n\n\t```\n\tcode\n\n- [ ] b\n').sections[0]?.items).toEqual([item(0, 4), item(5, 6)]);
	expect(parse('- [ ] a\n\n\t<!--\n\tnote\n\n  \n- [ ] b\n').sections[0]?.items).toEqual([item(0, 4), item(6, 7)]);
	expect(parse('- [ ] a\n\n```\ncode\n\n\n').untouched).toEqual([{ start: 2, end: 4 }]);
});

test('keeps the notes of pasted items and their four-space indent', () => {
	expect(parseList(fixture('pasted-items.md'), 0).sections[0]?.items).toEqual([
		item(0, 3, '    '),
		item(4, 8, '    '),
	]);
});

test('a query block in the list note stays in the list note', () => {
	const model = parseList(fixture('list-note-query.md'), 3);
	expect(model.listNote).toEqual({ start: 3, end: 9 });
	expect(model.sections).toEqual([{ headingLine: null, items: [item(10, 11)], endLine: 11 }]);
	expect(model.untouched).toEqual([]);
});

test('a comment that never closes hides every item below it', () => {
	const lines = fixture('unclosed.md');
	const model = parseList(lines, 0);
	expect(model.sections).toEqual([{ headingLine: null, items: [item(0, 1)], endLine: 5 }]);
	expect(model.untouched).toEqual([{ start: 2, end: 5 }]);
	expect(maskBlocks(lines, 0).unclosedStart).toBe(2);
});

test('a section ends after its last content, and an empty top section where the list note ends', () => {
	expect(parse('---\nprincelists: true\n---\nNote\n\n## H\n- [ ] a\n\nkept\n\n## K\n', 3)).toEqual({
		contentStart: 3,
		listNote: { start: 3, end: 4 },
		sections: [
			{ headingLine: null, items: [], endLine: 4 },
			{ headingLine: 5, items: [item(6, 7)], endLine: 9 },
			{ headingLine: 10, items: [], endLine: 11 },
		],
		untouched: [{ start: 8, end: 9 }],
	});
	expect(parse('## H\n- [ ] a\n').sections[0]).toEqual({ headingLine: null, items: [], endLine: 0 });
	expect(parse('Text\n---\n').sections.map((s) => s.headingLine)).toEqual([null, 0]);
});

test('a bullet without a checkbox before the first item belongs to the list note', () => {
	expect(parse('- plain\n- [ ] a\n')).toEqual({
		contentStart: 0,
		listNote: { start: 0, end: 1 },
		sections: [{ headingLine: null, items: [item(1, 2)], endLine: 2 }],
		untouched: [],
	});
});

test('maskBlocks turns a top-level %% or $$ region into a fence longer than any fence inside it', () => {
	const text = '%%\n````js\n- [ ] y\n````\n%%\n- [ ] a\n';
	expect(maskBlocks(splitLines(text), 0)).toEqual({
		text: '`````\n````js\n- [ ] y\n````\n`````\n- [ ] a\n',
		unclosedStart: null,
	});
	expect(parse(text).sections[0]?.items).toEqual([item(5, 6)]);
	expect(maskBlocks(splitLines('---\n---\na\r\n$$\r\nx\r\n$$'), 2).text).toBe('a\r\n```\r\nx\r\n```');
});

test('maskBlocks leaves %% and $$ alone inside a fence, in notes and within one line', () => {
	for (const text of ['```\n%%\n- [ ] x\n```\n', '- [ ] a\n\n\t%%\n\tx\n\t%%\n', '%% inline %%\n', '$$x$$\n']) {
		expect(maskBlocks(splitLines(text), 0)).toEqual({ text, unclosedStart: null });
	}
});

test('masking skips what a fence or an HTML block of types 1 to 5 holds', () => {
	for (const [open, close] of [
		['<!--', '-->'],
		['<pre>', '</pre>'],
	]) {
		const text = `- [ ] a\n\n${open}\n\`\`\`\n${close}\n\n%%\n- [ ] hidden\n%%\n\n- [ ] b\n`;
		expect(parse(text).sections[0]?.items).toEqual([item(0, 1), item(10, 11)]);
	}
	expect(parse('<!-- c -->\n\n%%\n- [ ] hidden\n%%\n\n- [ ] b\n').sections[0]?.items).toEqual([item(6, 7)]);
	// A backtick in the info string makes this line inline code, not a fence.
	expect(parse('```x```\n%%\n- [ ] y\n%%\n- [ ] b\n').sections[0]?.items).toEqual([item(4, 5)]);
});

test('a %% or $$ region indented 1 to 3 spaces is not masked', () => {
	for (const text of [' %%\n- [ ] y\n %%\n', '   $$\n- [ ] y\n   $$\n']) {
		expect(maskBlocks(splitLines(text), 0)).toEqual({ text, unclosedStart: null });
	}
	expect(parse(' %%\n- [ ] y\n %%\n').sections[0]?.items).toEqual([item(1, 3)]);
	expect(parse('   $$\n- [ ] y\n   $$\n').sections[0]?.items).toEqual([item(1, 3, '   ')]);
});

test('unclosedStart counts lines from the start of the file', () => {
	const frontmatter = '---\nprincelists: true\n---\nNote\n';
	const fences = ['```js\ncode\n', '%%\nhidden\n', '$$\nx', '~~~\n```\n', '````\n```', '  ```\ncode', '```', '%%', '$$'];
	const html = ['<!--\nhidden\n', '<pre>\ncode\n', '<script>\nx', '<?php\necho 1;', '<!DOCTYPE html', '<![CDATA[\nx', '  <!--\nx'];
	for (const body of [...fences, ...html]) {
		expect(maskBlocks(splitLines(frontmatter + body), 3).unclosedStart).toBe(4);
	}
	const closed = ['```\ncode\n```\n', '%% inline %%\n', '$$x$$\n', 'plain\n', '````\n```\n````'];
	// An end tag ends a type 1 block even when it doesn't match, and <div> ends at a blank line.
	const closedHtml = ['<!-- c -->\n', '<!--\nx\n-->\n', '<pre>\n</script>\n', '<?php echo 1; ?>', '<!DOCTYPE html>', '<div>\nx'];
	for (const body of [...closed, ...closedHtml]) {
		expect(maskBlocks(splitLines(frontmatter + body), 3).unclosedStart).toBeNull();
	}
});

test('a link reference definition that no CommonMark node covers is untouched content', () => {
	const model = parse('- [ ] a\n\n[x]: https://example.com\n\n- [ ] b\n');
	expect(model.sections).toEqual([{ headingLine: null, items: [item(0, 1), item(4, 5)], endLine: 5 }]);
	expect(model.untouched).toEqual([{ start: 2, end: 3 }]);
	expect(parse('- [ ] a\n\n[a]: /a\n"title"\nText\n').untouched).toEqual([
		{ start: 2, end: 4 },
		{ start: 4, end: 5 },
	]);
	expect(parse('- [ ] a\n\n[x]: /x\n').untouched).toEqual([{ start: 2, end: 3 }]);
	expect(parse('[x]: /x\n\n- [ ] a\n')).toEqual({
		contentStart: 0,
		listNote: { start: 0, end: 1 },
		sections: [{ headingLine: null, items: [item(2, 3)], endLine: 3 }],
		untouched: [],
	});
});

test('a setext heading starts after the link reference definitions its paragraph opens with', () => {
	expect(parse('- [ ] a\n\n[x]: https://example.com\nKitchen\n---\n- [ ] b\n')).toEqual({
		contentStart: 0,
		listNote: { start: 0, end: 0 },
		sections: [
			{ headingLine: null, items: [item(0, 1)], endLine: 3 },
			{ headingLine: 3, items: [item(5, 6)], endLine: 6 },
		],
		untouched: [{ start: 2, end: 3 }],
	});
	const inListNote = parse('[x]: /x\nKitchen\n---\n');
	expect(inListNote.listNote).toEqual({ start: 0, end: 1 });
	expect(inListNote.sections.map((s) => s.headingLine)).toEqual([null, 1]);
});

test('a file with lone CR endings keeps every range inside the file', () => {
	const lines = splitLines('- [ ] a\r\r```\rcode\r');
	expect(parseList(lines, 0).untouched).toEqual([{ start: 2, end: 4 }]);
	expect(maskBlocks(lines, 0).unclosedStart).toBe(2);
});

test('parses 1500 items under 10 headings in under a second', () => {
	let text = '';
	for (let h = 0; h < 10; h++) {
		text += `## Section ${h}\n`;
		for (let i = 0; i < 150; i++) text += `- [ ] item ${i} 📅 2026-10-30\n\n\tA note.\n`;
	}
	const lines = splitLines(text);
	const started = performance.now();
	const model = parseList(lines, 0);
	const elapsed = performance.now() - started;
	expect(model.sections.slice(1).map((s) => s.items.length)).toEqual(Array<number>(10).fill(150));
	expect(elapsed).toBeLessThan(1000);
});

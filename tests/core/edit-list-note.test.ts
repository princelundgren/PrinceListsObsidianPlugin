import { describe, expect, test } from 'vitest';
import { UnsafeEditError } from '../../src/core/edit-check';
import { getListNote, listNoteUnclosedBlock, listNoteWouldRestructure, setListNote } from '../../src/core/edit-list-note';
import { mapLine } from '../../src/core/guard';
import { joinLines, splitLines, type Line } from '../../src/core/lines';
import { isBlank } from '../../src/core/parse';
import {
	FIXTURES,
	JOINING_CASES,
	REFUSED_CASES,
	blocks,
	crlf,
	expectLinesAfterKept,
	expectLinesBeforeKept,
	expectRestKept,
	list,
	readFixture,
} from './edit-helpers';

const FRONTMATTER = '---\nprincelists: true\n---\n';

describe('getListNote', () => {
	test.each([
		[`${FRONTMATTER}Stuff\n\nMore\n\n- [ ] a\n`, 'Stuff\n\nMore'],
		// Beyond the table: without frontmatter, with CRLF endings, and with no note at all.
		['Note\n## H\n', 'Note'],
		[crlf(`${FRONTMATTER}Stuff\n\nMore\n- [ ] a\n`), 'Stuff\n\nMore'],
		[`${FRONTMATTER}\n- [ ] a\n`, ''],
		[FRONTMATTER, ''],
	])('%j', (text, expected) => {
		const { lines, model } = list(text);
		expect(getListNote(lines, model)).toBe(expected);
	});
});

describe('setListNote', () => {
	test.each([
		[`${FRONTMATTER}Old\n\n- [ ] a\n`, 'New note', `${FRONTMATTER}New note\n\n- [ ] a\n`],
		[FRONTMATTER, 'Note', `${FRONTMATTER}Note\n`],
		[`${FRONTMATTER}Old\n\n- [ ] a\n`, 'New note\n\n', `${FRONTMATTER}New note\n\n- [ ] a\n`],
		[`${FRONTMATTER}- [ ] a\n`, '<div>x</div>', `${FRONTMATTER}<div>x</div>\n\n- [ ] a\n`],
		// Beyond the table: one blank line between a note and an item or heading that follows it
		// directly, a setext heading included, and none for an empty note.
		[`${FRONTMATTER}## H\n- [ ] a\n`, 'Note', `${FRONTMATTER}Note\n\n## H\n- [ ] a\n`],
		[`${FRONTMATTER}Kitchen\n---\n- [ ] a\n`, 'Note', `${FRONTMATTER}Note\n\nKitchen\n---\n- [ ] a\n`],
		[`${FRONTMATTER}Old\n- [ ] a\n`, 'New', `${FRONTMATTER}New\n\n- [ ] a\n`],
		['Old\n- [ ] a\n', 'New', 'New\n\n- [ ] a\n'],
		[`${FRONTMATTER}Old\n- [ ] a\n`, '', `${FRONTMATTER}- [ ] a\n`],
		[`${FRONTMATTER}Old\n- [ ] a\n`, '\n \n', `${FRONTMATTER}- [ ] a\n`],
		// The file's endings, and its missing final newline.
		[crlf(`${FRONTMATTER}Old\n- [ ] a\n`), 'x\n\ny', crlf(`${FRONTMATTER}x\n\ny\n\n- [ ] a\n`)],
		[FRONTMATTER.slice(0, -1), 'Note', `${FRONTMATTER}Note`],
		// A note that becomes a section or an item is written as typed (spec, "The list note").
		[`${FRONTMATTER}Old\n\n- [ ] a\n`, 'Text\n---', `${FRONTMATTER}Text\n---\n\n- [ ] a\n`],
		[`${FRONTMATTER}Old\n\n- [ ] a\n`, '- [ ] x', `${FRONTMATTER}- [ ] x\n\n- [ ] a\n`],
		// An unclosed block hides nothing when nothing follows it.
		[FRONTMATTER, '```js\ncode', `${FRONTMATTER}\`\`\`js\ncode\n`],
	])('%j with %j', (text, markdown, expected) => {
		const { lines, model } = list(text);
		expect(joinLines(setListNote(lines, model, model.listNote, markdown).lines)).toBe(expected);
	});
	test.each([
		[`${FRONTMATTER}- [ ] a\n`, '```js\ncode', `${FRONTMATTER}\`\`\`js\ncode\n\n- [ ] a\n`],
		[`${FRONTMATTER}Old\n\n## H\n`, '%%\nhidden', `${FRONTMATTER}%%\nhidden\n\n## H\n`],
		[`${FRONTMATTER}- [ ] a\n`, '$$\nx', `${FRONTMATTER}$$\nx\n\n- [ ] a\n`],
		[`${FRONTMATTER}- [ ] a\n`, '<!--\nhidden', `${FRONTMATTER}<!--\nhidden\n\n- [ ] a\n`],
		// A fence or comment further down closes the note's block, so until the note closes it, what
		// follows reads differently: here a fenced checkbox line reads as an item. No line changes.
		[`${FRONTMATTER}- [ ] a\n\n<!-- c -->\n`, '<!--\nhidden', `${FRONTMATTER}<!--\nhidden\n\n- [ ] a\n\n<!-- c -->\n`],
		[
			`${FRONTMATTER}- [ ] a\n\n\`\`\`\n- [ ] x\n\`\`\`\n`,
			'```js\ncode',
			`${FRONTMATTER}\`\`\`js\ncode\n\n- [ ] a\n\n\`\`\`\n- [ ] x\n\`\`\`\n`,
		],
		[`${FRONTMATTER}- [ ] a\n\n<!-- c -->\n- [ ] b\n`, '<!--\nhidden', `${FRONTMATTER}<!--\nhidden\n\n- [ ] a\n\n<!-- c -->\n- [ ] b\n`],
		[`${FRONTMATTER}- [ ] a\n\n\`\`\`\n[r]: /u\n`, '```js\ncode', `${FRONTMATTER}\`\`\`js\ncode\n\n- [ ] a\n\n\`\`\`\n[r]: /u\n`],
	])('saves %j with %j, which leaves a block open: what follows stays hidden until it closes', (text, markdown, expected) => {
		const { lines, model } = list(text);
		expect(joinLines(setListNote(lines, model, model.listNote, markdown).lines)).toBe(expected);
		expect(listNoteUnclosedBlock(markdown)).toBe(true);
	});
	test.each([
		// The first item, indented to a list item's content column, would become that item's child.
		[`${FRONTMATTER}\n  - [ ] a\n`, '- bullet'],
		[`${FRONTMATTER}\n   - [ ] a\n`, '```\nx\n```\n1. one'],
	])('refuses %j with %j, which would take in what follows even after an empty line', (text, markdown) => {
		const { lines, model } = list(text);
		expect(() => setListNote(lines, model, model.listNote, markdown)).toThrow(UnsafeEditError);
		expect(joinLines(lines)).toBe(text);
	});
	test('refuses a range that is not in the lines, or starts above the content', () => {
		const text = `${FRONTMATTER}Note\n\n- [ ] a\n`;
		const { lines, model } = list(text);
		for (const note of [
			{ start: 2, end: 4 },
			{ start: 4, end: 3 },
			{ start: 3, end: 7 },
			{ start: -1, end: 0 },
		]) {
			expect(() => setListNote(lines, model, note, 'x'), JSON.stringify(note)).toThrow(
				'The list note range is not in these lines; seed it again from the model',
			);
		}
		expect(joinLines(lines)).toBe(text);
		expect(joinLines(setListNote(lines, model, { start: 6, end: 6 }, '').lines)).toBe(text);
	});
	test('writing back what getListNote reads leaves the file byte-identical, but for the blank line', () => {
		for (const text of [...Object.values(JOINING_CASES), ...FIXTURES.map(readFixture)]) {
			const { lines, model } = list(text);
			const { start, end } = model.listNote;
			const after = joinLines(setListNote(lines, model, model.listNote, getListNote(lines, model)).lines);
			// The note is followed directly by an item or a heading, which gets its blank line.
			const followed = end > start && end < lines.length && !isBlank(lines[end]?.text ?? '');
			const expected = followed ? joinLines([...lines.slice(0, end), { text: '', eol: '\n' }, ...lines.slice(end)]) : text;
			expect(after, JSON.stringify(text)).toBe(expected);
		}
	});
	test('leaves every item, heading and untouched block as it parsed', () => {
		const cases = [...Object.values(JOINING_CASES), ...Object.values(REFUSED_CASES), ...FIXTURES.map(readFixture)];
		for (const text of cases) {
			const { lines, model } = list(text);
			const { start, end } = model.listNote;
			const oldNote = joinLines(lines.slice(start, end));
			for (const markdown of [getListNote(lines, model), 'New note', '', '<div>x</div>', 'Text\n---', '- [ ] x', 'a\n\n  b\n']) {
				const result = setListNote(lines, model, model.listNote, markdown).lines;
				expectRestKept(text, joinLines(result), { removed: blocks(oldNote), added: blocks(markdown) });
				expectLinesBeforeKept(lines, result, start);
				expectLinesAfterKept(lines, result, end);
			}
		}
	});
});

// Task 9 saves the list note on every keystroke. Each save re-parses the view's text and passes the
// range the previous save wrote, which the model seeds when the field takes focus. A refused save
// keeps the text and the range, and the next keystroke tries again.
function typeInto(text: string, typed: readonly string[]) {
	let range = list(text).model.listNote;
	let current = text;
	return typed.map((markdown) => {
		const { lines, model } = list(current);
		try {
			const result = setListNote(lines, model, range, markdown);
			current = joinLines(result.lines);
			range = result.note;
			return { markdown, text: current, range, refused: false };
		} catch (error) {
			if (!(error instanceof UnsafeEditError)) throw error;
			return { markdown, text: current, range, refused: true };
		}
	});
}

// Each value the field holds while `typed` is typed after `from`, one character at a time.
const keystrokes = (from: string, typed: string) =>
	Array.from({ length: typed.length - from.length }, (_, i) => typed.slice(0, from.length + i + 1));

const texts = (lines: readonly Line[]) => lines.map((line) => line.text);

// The lines before the range never change. The lines after it are the ones after the note when the
// session started, with one blank line in front when the note's first save added it. A saved range
// holds exactly what was typed, without its trailing blank lines.
function expectSessionKeepsRest(text: string, steps: ReturnType<typeof typeInto>) {
	const { lines, model } = list(text);
	const before = texts(lines.slice(0, model.listNote.start));
	const after = texts(lines.slice(model.listNote.end));
	for (const step of steps) {
		const now = splitLines(step.text);
		const label = `${JSON.stringify(text)} typing ${JSON.stringify(step.markdown)}`;
		expect(texts(now.slice(0, step.range.start)), label).toEqual(before);
		const rest = texts(now.slice(step.range.end));
		const separated = after.length > 0 && !isBlank(after[0] as string) ? ['', ...after] : after;
		expect([after, separated], label).toContainEqual(rest);
		if (step.refused) continue;
		const typedLines = texts(splitLines(step.markdown));
		while (typedLines.length > 0 && isBlank(typedLines[typedLines.length - 1] as string)) typedLines.pop();
		expect(texts(now.slice(step.range.start, step.range.end)), label).toEqual(typedLines);
	}
}

describe('setListNote across a typing session', () => {
	const shopping = `${FRONTMATTER}Hello\n\n- [ ] milk\n- [ ] eggs\n\n## Kitchen\n- [ ] jars\n`;
	test.each([
		[shopping, 'Hello\n```js\nx\n```'],
		[`${FRONTMATTER}Hello\n\n- [ ] milk\n`, 'Hello\n%%\nx\n%%'],
		[`${FRONTMATTER}Hello\n\n- [ ] milk\n`, 'Hello\n$$\nx\n$$'],
		[`${FRONTMATTER}Hello\n\n- [ ] milk\n`, 'Hello\n<!--\nx\n-->'],
		// The first save writes the blank line in front of the item, and later saves leave it.
		[`${FRONTMATTER}Hello\n- [ ] milk\n`, 'Hello\n```js\nx\n```'],
	])('%j: typing %j hides what follows while the block is open, and deletes nothing', (text, typed) => {
		const steps = typeInto(text, keystrokes('Hello', typed));
		expectSessionKeepsRest(text, steps);
		expect(steps.filter((step) => step.refused)).toEqual([]);
		for (const step of steps) {
			if (listNoteUnclosedBlock(step.markdown)) expect(list(step.text).items, step.markdown).toEqual([]);
		}
		const { lines, model } = list(text);
		const rest = joinLines(lines.slice(model.listNote.end));
		expect((steps[steps.length - 1] as (typeof steps)[number]).text).toBe(`${FRONTMATTER}${typed}\n${isBlank(rest.split('\n')[0] as string) ? '' : '\n'}${rest}`);
	});
	test.each([
		// A `-` under text makes it a setext heading, then a bullet: the note shrinks and grows again.
		[`${FRONTMATTER}Weekend\n\n- [ ] milk\n`, 'Weekend', 'Weekend\n- eg', `${FRONTMATTER}Weekend\n- eg\n\n- [ ] milk\n`],
		[`${FRONTMATTER}Hello\n\n- [ ] milk\n`, 'Hello', 'Hello\n# K', `${FRONTMATTER}Hello\n# K\n\n- [ ] milk\n`],
		[`${FRONTMATTER}Hello\n\n- [ ] milk\n`, 'Hello', 'Hello\n\nText\n---', `${FRONTMATTER}Hello\n\nText\n---\n\n- [ ] milk\n`],
		[`${FRONTMATTER}Hello\n\n- [ ] milk\n`, 'Hello', 'Hello\n```', `${FRONTMATTER}Hello\n\`\`\`\n\n- [ ] milk\n`],
		// A fence further down closes the open block, so the re-parsed list note reads as closed while
		// the lines the editor wrote are still open. Closing the block in the note still saves.
		[
			`${FRONTMATTER}- [ ] a\n\n\`\`\`\n- [ ] x\n\`\`\`\n`,
			'',
			'```js\nx\n```',
			`${FRONTMATTER}\`\`\`js\nx\n\`\`\`\n\n- [ ] a\n\n\`\`\`\n- [ ] x\n\`\`\`\n`,
		],
	])('%j: typing %j to %j writes it once and keeps the rest', (text, from, typed, expected) => {
		const steps = typeInto(text, keystrokes(from, typed));
		expectSessionKeepsRest(text, steps);
		expect((steps[steps.length - 1] as (typeof steps)[number]).text).toBe(expected);
	});
	test('a range that an outside change moved down keeps the blocks above it', () => {
		// The field took focus on a list with no note. Sync then adds a paragraph above the item, and
		// mapLine moves the empty range below it, as Task 9 maps it.
		const before = splitLines('- [ ] a\n');
		const { lines, model } = list('Phone\n\n- [ ] a\n');
		const start = mapLine(before, lines, list('- [ ] a\n').model.listNote.start) as number;
		const result = setListNote(lines, model, { start, end: start }, 'M');
		expect(joinLines(result.lines)).toBe('Phone\n\nM\n\n- [ ] a\n');
		expect(result.note).toEqual({ start: 2, end: 3 });
	});
	test('erasing the note and typing it again restores the file', () => {
		const text = `${FRONTMATTER}Hello\n\n- [ ] milk\n`;
		const erase = ['Hell', 'Hel', 'He', 'H', ''];
		const steps = typeInto(text, [...erase, 'H', 'He', 'Hel', 'Hell', 'Hello']);
		expectSessionKeepsRest(text, steps);
		expect((steps[4] as (typeof steps)[number]).text).toBe(`${FRONTMATTER}\n- [ ] milk\n`);
		expect((steps[steps.length - 1] as (typeof steps)[number]).text).toBe(text);
	});
	test('random typing on every fixture keeps every line outside the range', () => {
		const random = seeded(7);
		const keys = ['`', '`', '`', '%', '%', '$', '$', '<', '!', '-', '-', '>', '#', ' ', '\n', '\n', 'x', '=', '[', ']', '*', '1', '.', '\t'];
		const cases = [...Object.values(JOINING_CASES), ...Object.values(REFUSED_CASES), ...FIXTURES.map(readFixture)];
		for (const text of cases) {
			for (let session = 0; session < 8; session++) {
				const { lines, model } = list(text);
				let field = getListNote(lines, model);
				const typed: string[] = [];
				for (let k = 0; k < 24; k++) {
					field = random() < 0.2 ? field.slice(0, -1) : field + (keys[Math.floor(random() * keys.length)] as string);
					typed.push(field);
				}
				expectSessionKeepsRest(text, typeInto(text, typed));
			}
		}
	});
});

// A small deterministic generator, so a failure names the same session every run.
function seeded(seed: number) {
	return () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 2 ** 32;
	};
}

describe('listNoteWouldRestructure', () => {
	test.each(['Text\n---', '## H', '- [ ] x'])('%j would become a section or an item', (markdown) => {
		expect(listNoteWouldRestructure(markdown)).toBe(true);
	});
	test.each(['Text\n\n---', 'plain *text*', '- bullet', ''])('%j stays part of the note', (markdown) => {
		expect(listNoteWouldRestructure(markdown)).toBe(false);
	});
});

describe('listNoteUnclosedBlock', () => {
	test.each(['```js\ncode', '%%\nhidden', '$$\nx', '<!--\nhidden'])('%j is left open', (markdown) => {
		expect(listNoteUnclosedBlock(markdown)).toBe(true);
	});
	test.each(['```\ncode\n```', '%% inline %%', '$$x$$', 'plain', ''])('%j is closed', (markdown) => {
		expect(listNoteUnclosedBlock(markdown)).toBe(false);
	});
});

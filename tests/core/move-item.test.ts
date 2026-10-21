import { describe, expect, test } from 'vitest';
import { UnsafeEditError, moveItem, moveItemWithLineMap } from '../../src/core/edit-items';
import { joinLines, splitLines, type Line } from '../../src/core/lines';
import type { ItemBlock, Section } from '../../src/core/parse';
import { FIXTURES, JOINING_CASES, REFUSED_CASES, crlf, expectRestKept, list, readFixture } from './edit-helpers';

type Target = { after: number } | { firstIn: number };

const move = (text: string, n: number, to: Target) => {
	const { lines, model, item, section } = list(text);
	const target = 'after' in to ? { after: item(to.after) } : { firstIn: section(to.firstIn) };
	return joinLines(moveItem(lines, model, item(n), target));
};

describe('moveItem', () => {
	test('an item from an older model throws a clear error, not a TypeError', () => {
		const { lines, model, item } = list('- [ ] a\n- [ ] b\n');
		const stale = { ...item(0), titleLine: 7, endLine: 8 };
		expect(() => moveItem(lines, model, stale, { after: item(1) })).toThrow('not in this model');
	});
	test.each<[string, number, Target, string]>([
		['- [ ] a\n\n\tn\n\n- [ ] b\n', 0, { after: 1 }, '- [ ] b\n\n- [ ] a\n\n\tn\n'],
		['## G\n- [ ] a\n\n- [ ] b\n## K\n- [ ] c\n', 0, { after: 2 }, '## G\n- [ ] b\n\n## K\n- [ ] c\n- [ ] a\n'],
		['- [ ] a\n- [ ] b', 1, { firstIn: 0 }, '- [ ] b\n- [ ] a'],
		['- [ ] a\n## H\n- [ ] b\n', 0, { firstIn: 1 }, '## H\n- [ ] a\n- [ ] b\n'],
		['## G\n- [ ] a\n\nNote\n\n- [ ] b\n## K\n- [ ] c\n', 1, { after: 2 }, '## G\n- [ ] a\n\nNote\n\n## K\n- [ ] c\n- [ ] b\n'],
		// Beyond the table: an item moved after itself stays.
		['- [ ] a\n- [ ] b\n', 1, { after: 1 }, '- [ ] a\n- [ ] b\n'],
	])('%j, moving item %i to %j', (text, n, to, expected) => {
		expect(move(text, n, to)).toBe(expected);
	});
	test('moves the first item of top-level-untouched.md after the last, and changes nothing else', () => {
		const lines = splitLines(readFixture('top-level-untouched.md'));
		const expected = joinLines([lines[24] as Line, ...lines.slice(1, 24), lines[0] as Line]);
		expect(move(readFixture('top-level-untouched.md'), 0, { after: 1 })).toBe(expected);
	});
	test('leaving a section, the gap after the item moves to its end when the item sat between two gaps', () => {
		const text = '## G\n- [ ] a\n\n- [ ] b\n\nText\n## K\n- [ ] c\n';
		expect(move(text, 1, { after: 2 })).toBe('## G\n- [ ] a\n\nText\n\n## K\n- [ ] c\n- [ ] b\n');
	});
	test('leaving a section, a gap still between two items stays', () => {
		const text = '## G\n- [ ] a\n- [ ] b\n\n- [ ] c\n## K\n- [ ] d\n';
		expect(move(text, 1, { after: 3 })).toBe('## G\n- [ ] a\n\n- [ ] c\n## K\n- [ ] d\n- [ ] b\n');
	});
	test('leaving a section, a gap that never sat directly between two items stays', () => {
		const text = '## G\n- [ ] a\n\nText\n\n- [ ] b\n## K\n- [ ] c\n';
		expect(move(text, 0, { after: 2 })).toBe('## G\n\nText\n\n- [ ] b\n## K\n- [ ] c\n- [ ] a\n');
	});
	test('leaving a section, the gap before the item stays, so untouched text never joins the item above', () => {
		const text = '## G\n- [ ] a\n\n- [ ] b\n\n\t```\n\tx\n\t```\nText\n## K\n- [ ] c\n';
		const result = move(text, 1, { after: 2 });
		expect(result).toBe('## G\n- [ ] a\n\nText\n## K\n- [ ] c\n- [ ] b\n\n\t```\n\tx\n\t```\n');
		expect(list(result).model.untouched).toEqual([{ start: 3, end: 4 }]);
	});
	test('writes an empty line where text after a boundary the move makes would join the block above', () => {
		const { setextHeadingTop, fenceThenText, sameSectionFence, hrUnderUntouched } = JOINING_CASES;
		expect(move(setextHeadingTop, 0, { firstIn: 0 })).toBe('Note\n\n- [ ] a\n\nKitchen\n---\n');
		expect(move(crlf(setextHeadingTop), 0, { firstIn: 0 })).toBe(crlf('Note\n\n- [ ] a\n\nKitchen\n---\n'));
		expect(move(hrUnderUntouched, 1, { firstIn: 0 })).toBe('- [ ] a\n## G\n- [ ] z\n\nU\n\n---\n- [ ] b\n');
		expect(move(fenceThenText, 1, { after: 2 })).toBe(
			'## G\n- [ ] z\n\nText\n## K\n- [ ] c\n- [ ] a\n\n\t```\n\tx\n\t```\n',
		);
		expect(move(sameSectionFence, 1, { firstIn: 0 })).toBe('- [ ] a\n\n\t```\n\tx\n\t```\n- [ ] b\n\nText\n');
		// A move, unlike an insert, can put the empty line before the item, so it never joins a <div>.
		expect(move(REFUSED_CASES.divInEmptySection, 0, { firstIn: 1 })).toBe('## H\n<div>\nx\n</div>\n\n- [ ] a\n\n## K\n');
	});
	test('writes an empty line at each boundary inside a block that changed, and only there', () => {
		// Both x items take in a Text below them, as two blocks with the same source text.
		const twice = '- [ ] x\n- [ ] a\n\n\t```\n\tf\n\t```\nText\n'.repeat(2);
		const a = '- [ ] a\n\n\t```\n\tf\n\t```\n';
		expect(move(twice, 0, { after: 3 })).toBe(`${a}- [ ] x\n\nText\n${a}- [ ] x\n\nText\n`);
	});
	test('writes the empty line in a changed block whose text matches a block that was there before', () => {
		// The last x takes Text in from the start. Moved below a, the first x takes in the other Text and
		// comes first, so the changed block is the first of the two copies.
		const text = '- [ ] x\n- [ ] a\n\n\t```\n\tf\n\t```\nText\n- [ ] x\nText\n';
		expect(move(text, 0, { after: 1 })).toBe('- [ ] a\n\n\t```\n\tf\n\t```\n- [ ] x\n\nText\n- [ ] x\nText\n');
	});
	test('when no changed block points at a boundary, writes an empty line at every boundary', () => {
		// The definition above b belongs to no block, and "title" vanishes into it.
		const fence = '- [ ] a\n\n\t```\n\tx\n\t```\n';
		expect(move(`[r]: /u\n${fence}2. [ ] b\n`, 0, { after: 1 })).toBe(`[r]: /u\n\n2. [ ] b\n\n${fence}`);
		// The empty line that already follows c gets no second one.
		expect(move(`[r]: /u\n${fence}"title"\n## K\n- [ ] c\n\nEnd\n`, 0, { after: 1 })).toBe(
			`[r]: /u\n\n"title"\n## K\n- [ ] c\n\n${fence}\nEnd\n`,
		);
	});
	test('repeats the pass when an empty line uncovers another join', () => {
		// Once Text no longer joins g, 2. can't start a list under it, so it joins Text.
		const text = '2. [ ] d\n- [ ] a\n\n\t```\n\tx\n\t```\nText\n- [ ] g\n\n\tnote\n';
		expect(move(text, 0, { after: 2 })).toBe('- [ ] a\n\n\t```\n\tx\n\t```\n- [ ] g\n\n\tnote\n\nText\n\n2. [ ] d\n');
	});
	test('adds no empty line when the last line, without a final newline, moves', () => {
		const text = '## G\n- [ ] a\n\n\tnote\n## K\n- [ ] c';
		expect(move(text, 0, { after: 1 })).toBe('## G\n## K\n- [ ] c\n- [ ] a\n\n\tnote');
		expect(move(text, 1, { firstIn: 1 })).toBe('## G\n- [ ] c\n- [ ] a\n\n\tnote\n## K');
	});
	test('refuses a move that leaves text an item takes in, even after an empty line', () => {
		const { widerColumnDelete, widerColumnMove } = REFUSED_CASES;
		expect(() => move(widerColumnDelete, 0, { after: 1 })).toThrow(UnsafeEditError);
		expect(() => move(widerColumnDelete, 1, { firstIn: 0 })).toThrow(UnsafeEditError);
		expect(() => move(widerColumnMove, 0, { after: 1 })).toThrow(UnsafeEditError);
	});
	test('every move leaves every item, heading and untouched block as it parsed', () => {
		for (const text of [...Object.values(JOINING_CASES), ...FIXTURES.map(readFixture)]) {
			const { lines, model, items } = list(text);
			const targets = [...items.map((it) => ({ after: it })), ...model.sections.map((s) => ({ firstIn: s }))];
			for (const it of items) {
				for (const to of targets) expectRestKept(text, joinLines(moveItem(lines, model, it, to)));
			}
		}
	});
	test('moveItemWithLineMap gives the line each line went to, or none for an empty line dropped, and only empty lines it wrote are new', () => {
		for (const text of [...Object.values(JOINING_CASES), ...FIXTURES.map(readFixture)]) {
			const { lines, model, items } = list(text);
			const targets = [...items.map((it) => ({ after: it })), ...model.sections.map((s) => ({ firstIn: s }))];
			for (const it of items) {
				for (const to of targets) {
					const result = moveItemWithLineMap(lines, model, it, to);
					expect(result.lines).toEqual(moveItem(lines, model, it, to));
					result.moved.forEach((at, i) => {
						if (at === null) expect((lines[i] as Line).text).toBe('');
						else expect(result.lines[at]?.text).toBe((lines[i] as Line).text);
					});
					const reached = result.moved.filter((at) => at !== null);
					expect(new Set(reached).size).toBe(reached.length);
					expect(result.lines.filter((line, at) => !reached.includes(at) && line.text !== '')).toEqual([]);
				}
			}
		}
	});
	test('20 random moves in a row keep the rest parsing as it did, and add or lose no line', () => {
		const example = readFixture('example.md');
		// Nothing in these files can join an item, so no move needs an empty line.
		for (const text of [example, example.slice(0, -1), readFixture('top-level-untouched.md')]) {
			const sorted = splitLines(text).map((line) => line.text).sort();
			// A fixed seed makes every run try the same moves.
			let seed = 7;
			const random = (count: number) => {
				seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
				return Math.floor((seed / 2 ** 32) * count);
			};
			let current = text;
			for (let i = 0; i < 20; i++) {
				const { lines, model, items } = list(current);
				const item = items[random(items.length)] as ItemBlock;
				const pick = random(items.length + model.sections.length);
				const to =
					pick < items.length
						? { after: items[pick] as ItemBlock }
						: { firstIn: model.sections[pick - items.length] as Section };
				const next = joinLines(moveItem(lines, model, item, to));
				expectRestKept(current, next);
				expect(splitLines(next).map((line) => line.text).sort()).toEqual(sorted);
				expect(next.endsWith('\n')).toBe(text.endsWith('\n'));
				current = next;
			}
		}
	});
});

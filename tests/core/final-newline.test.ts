import { describe, expect, test } from 'vitest';
import { UnsafeEditError } from '../../src/core/edit-check';
import { followLine } from '../../src/core/follow';
import {
	planHeadingDelete,
	planHeadingInsert,
	planItemDelete,
	planItemInsert,
	planItemMove,
	type ItemPlace,
} from '../../src/core/list-actions';
import { splitLines } from '../../src/core/lines';
import { contentStartOf, crlf, FIXTURES, JOINING_CASES, list, readFixture, REFUSED_CASES } from './edit-helpers';

// The review's two cases: b's gap moves to its section's end, and b's delete leaves a's gap last.
const MOVE_CASE = '- [ ] x\n## H\n- [ ] a\n\n- [ ] b\n\n- [ ] c';
const DELETE_CASE = '- [ ] a\n\n- [ ] b';
const start = (text: string) => contentStartOf(splitLines(text));
const endsWithNewline = (text: string) => /[\r\n]$/.test(text);

function unlessRefused<T>(plan: () => T): T | null {
	try {
		return plan();
	} catch (error) {
		if (error instanceof UnsafeEditError) return null;
		throw error;
	}
}

describe('in a file without a final newline, an edit leaves no empty line last', () => {
	test("a move that takes a gap to the end keeps the file's missing final newline, in LF and CRLF", () => {
		expect(planItemMove(MOVE_CASE, 0, 4, { after: 0 })?.next).toBe('- [ ] x\n- [ ] b\n## H\n- [ ] a\n\n- [ ] c');
		expect(planItemMove(crlf(MOVE_CASE), 0, 4, { after: 0 })?.next).toBe(crlf('- [ ] x\n- [ ] b\n## H\n- [ ] a\n\n- [ ] c'));
	});
	test('the dropped gap maps to nothing, and every other line follows the move', () => {
		expect(planItemMove(MOVE_CASE, 0, 4, { after: 0 })?.edit).toEqual({ start: 1, kind: 'move', moved: [0, 2, 3, 4, 1, null, 5] });
	});
	test("a delete that leaves a gap last keeps the file's missing final newline, in LF and CRLF", () => {
		expect(planItemDelete(DELETE_CASE, 0, 2)?.next).toBe('- [ ] a');
		expect(planItemDelete(crlf(DELETE_CASE), 0, 2)?.next).toBe('- [ ] a');
	});
	test('a move or a delete that leaves two empty lines last drops both', () => {
		const twoGaps = '- [ ] x\n## H\n- [ ] a\n\n- [ ] b\n\n\n- [ ] c';
		expect(planItemMove(twoGaps, 0, 4, { after: 0 })?.next).toBe('- [ ] x\n- [ ] b\n## H\n- [ ] a\n\n- [ ] c');
		expect(planItemDelete('- [ ] a\n\n\n- [ ] b', 0, 3)?.next).toBe('- [ ] a');
	});
	test('a file that ends with a newline keeps its empty lines at the end', () => {
		expect(planItemMove(`${MOVE_CASE}\n`, 0, 4, { after: 0 })?.next).toBe('- [ ] x\n- [ ] b\n## H\n- [ ] a\n\n- [ ] c\n\n');
		expect(planItemDelete(`${DELETE_CASE}\n`, 0, 2)?.next).toBe('- [ ] a\n\n');
	});
	test('every insert, move and delete keeps whether the file ends with a newline, and every item and heading follows it', () => {
		const texts = [MOVE_CASE, DELETE_CASE, ...Object.values(JOINING_CASES), ...Object.values(REFUSED_CASES), ...FIXTURES.map(readFixture)];
		const variants = texts.flatMap((text) => {
			const bare = text.replace(/\n$/, '');
			return [bare, `${bare}\n`, crlf(bare), crlf(`${bare}\n`)];
		});
		for (const text of variants) {
			const { model, items } = list(text);
			const headings = model.sections.flatMap((s) => (s.headingLine === null ? [] : [s.headingLine]));
			const places: ItemPlace[] = ['first', ...items.map((i) => ({ after: i.titleLine })), ...headings.map((h) => ({ firstUnder: h }))];
			const planned = [
				...items.flatMap((item) => places.map((place) => () => planItemMove(text, start(text), item.titleLine, place))),
				...items.map((item) => () => planItemDelete(text, start(text), item.titleLine)),
				...headings.map((line) => () => planHeadingDelete(text, start(text), line)),
				...places.map((place) => () => planItemInsert(text, start(text), place)),
				...items.map((item) => () => planHeadingInsert(text, start(text), { afterItem: item.titleLine })),
			];
			const before = splitLines(text);
			for (const plan of planned) {
				const result = unlessRefused(plan);
				if (!result) continue;
				// Deleting the only block leaves an empty file, which has no last line at all.
				if (result.next !== '') expect(endsWithNewline(result.next), JSON.stringify([text, result.next])).toBe(endsWithNewline(text));
				const after = splitLines(result.next);
				for (const line of [...headings, ...items.map((i) => i.titleLine)]) {
					const followed = followLine(line, result.edit);
					if (followed !== null) expect(after[followed]?.text, JSON.stringify([text, line])).toBe(before[line]?.text);
				}
			}
		}
	});
});

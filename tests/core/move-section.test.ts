import { describe, expect, test } from 'vitest';
import { UnsafeEditError } from '../../src/core/edit-items';
import { planSectionMove } from '../../src/core/list-actions';
import { joinLines } from '../../src/core/lines';
import { moveSectionWithLineMap } from '../../src/core/move-section';
import { list } from './edit-helpers';

const moved = (text: string, headingLine: number, before: number | null) => planSectionMove(text, 0, headingLine, before)?.next;

describe('planSectionMove', () => {
	test('a section takes its items, notes, archived items and text along', () => {
		const text = 'Top\n\n## A\n- [ ] a\n\tnote\n- [x] old ✔ 2026-10-01 09:00\n\nText\n## B\n- [ ] b\n';
		expect(moved(text, 2, null)).toBe('Top\n\n## B\n- [ ] b\n## A\n- [ ] a\n\tnote\n- [x] old ✔ 2026-10-01 09:00\n\nText\n');
	});
	test('a deeper heading below is a section of its own and stays', () => {
		expect(moved('## A\n- [ ] a\n### A1\n- [ ] a1\n## B\n', 0, 4)).toBe('### A1\n- [ ] a1\n## A\n- [ ] a\n## B\n');
	});
	test('an empty line keeps text that would join the item above apart', () => {
		expect(moved('B\n---\n- [ ] b\n## A\n- [ ] a\n', 0, null)).toBe('## A\n- [ ] a\n\nB\n---\n- [ ] b\n');
	});
	test('keeps CRLF endings and a missing final newline, and maps each line', () => {
		const text = '## A\r\n- [ ] a\r\n## B\r\n- [ ] b';
		expect(moved(text, 2, 0)).toBe('## B\r\n- [ ] b\r\n## A\r\n- [ ] a');
		const { lines, model, section } = list(text);
		const result = moveSectionWithLineMap(lines, model, section(2), section(1));
		expect(joinLines(result.lines)).toBe('## B\r\n- [ ] b\r\n## A\r\n- [ ] a');
		expect(result.moved).toEqual([2, 3, 0, 1]);
	});
	test('a fence that is never closed would take in what follows, so the move throws', () => {
		expect(() => moved('## A\n- [ ] a\n## B\n```\ncode\n', 2, 0)).toThrow(UnsafeEditError);
	});
	test('a move that changes nothing, or a line that is not a heading, gives null', () => {
		const text = '## A\n- [ ] a\n## B\n- [ ] b\n';
		expect(moved(text, 0, 2)).toBeUndefined();
		expect(moved(text, 2, null)).toBeUndefined();
		expect(moved(text, 1, null)).toBeUndefined();
		expect(moved(text, 2, 1)).toBeUndefined();
	});
});

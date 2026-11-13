import { describe, expect, test } from 'vitest';
import { ListEditing } from '../../src/core/editing';
import { followLine } from '../../src/core/follow';
import { countPhrase, groupState, headingChoices, planGroupDelete, planGroupLineEdit, planGroupTick } from '../../src/core/group-edits';
import { EditHistory } from '../../src/core/history';
import { tickLine } from '../../src/core/item-line';
import { splitLines } from '../../src/core/lines';
import { planHeadingDelete, planItemDelete } from '../../src/core/list-actions';
import { RowSelection } from '../../src/core/selection';
import { setStar } from '../../src/core/star';
import { contentStartOf, crlf } from './edit-helpers';

const FRONT = '---\nprincelists: true\n---\n';
const TEXT = FRONT + '- [ ] a\n## B\n- [ ] b\n## C\n- [ ] c\n';
const body = (t: string | undefined) => t?.slice(FRONT.length);
const NOW = new Date(2026, 10, 7, 12, 0);

const linesOf = (text: string) => splitLines(text).map((line) => line.text);

describe('planGroupTick', () => {
	test('ticks only the unticked items', () => {
		const text = TEXT;
		const plan = planGroupTick(text, 3, [3, 4, 7], true, NOW);
		const expected = linesOf(text);
		expected[3] = tickLine('- [ ] a', NOW);
		expected[7] = tickLine('- [ ] c', NOW);
		expect(linesOf(plan?.next ?? '')).toEqual(expected);
		expect(plan).toMatchObject({ changed: 2, skipped: 0, edit: { start: 3, delta: 0, kind: 'change' } });
	});

	test('moves a repeating item with its checklist and counts it as changed', () => {
		const text = TEXT.replace('- [ ] c', '- [ ] c ⏳ 2026-11-07 🔁 every day\n\t- [x] step');
		const plan = planGroupTick(text, 3, [3, 7], true, NOW);
		const expected = linesOf(text);
		expected[3] = tickLine('- [ ] a', NOW);
		expected[7] = '- [ ] c ⏳ 2026-11-08 🔁 every day';
		expected[8] = '\t- [ ] step';
		expect(linesOf(plan?.next ?? '')).toEqual(expected);
		expect(plan).toMatchObject({ changed: 2, skipped: 0, edit: { start: 3, delta: 0, kind: 'change' } });
	});

	test("skips a line that can't repeat and counts it", () => {
		const text = TEXT.replace('- [ ] c', '- [ ] c 🔁 every weekday');
		const plan = planGroupTick(text, 3, [3, 7], true, NOW);
		const expected = linesOf(text);
		expected[3] = tickLine('- [ ] a', NOW);
		expect(linesOf(plan?.next ?? '')).toEqual(expected);
		expect(plan).toMatchObject({ changed: 1, skipped: 1 });
	});

	test("throws the first skipped line's error when every item it would change was skipped", () => {
		const text = TEXT.replace('- [ ] a', '- [ ] a 🔚 soon 🔁 every day').replace('- [ ] c', '- [ ] c 🔁 every weekday');
		expect(() => planGroupTick(text, 3, [3, 7], true, NOW)).toThrow(expect.objectContaining({ problem: 'end' }));
	});

	test('returns null when nothing changes', () => {
		expect(planGroupTick(TEXT, 3, [3, 7], false, NOW)).toBeNull();
	});
});

describe('planGroupLineEdit', () => {
	test("edits each item's line and no other", () => {
		const plan = planGroupLineEdit(TEXT, 3, [3, 4, 5], (line) => setStar(line, true));
		const expected = linesOf(TEXT);
		expected[3] = setStar('- [ ] a', true);
		expected[5] = setStar('- [ ] b', true);
		expect(linesOf(plan?.next ?? '')).toEqual(expected);
		expect(plan).toMatchObject({ changed: 2, edit: { kind: 'change', start: 3, delta: 0 } });
	});
});

describe('groupState', () => {
	test('counts what the selection holds', () => {
		expect(groupState(TEXT, 3, [3, 4, 7])).toEqual({
			items: 2,
			headings: 1,
			anyUnticked: true,
			anyTicked: false,
			anyUnstarred: true,
			anyStarred: false,
			anyDated: false,
		});
	});
});

describe('group state and untick', () => {
	const mixed = FRONT + '- [x] a ⭐\n- [ ] b ⏳ 2026-11-08\n';

	test('reports ticked, starred and dated items', () => {
		expect(groupState(mixed, 3, [3, 4])).toEqual({
			items: 2,
			headings: 0,
			anyUnticked: true,
			anyTicked: true,
			anyUnstarred: true,
			anyStarred: true,
			anyDated: true,
		});
	});

	test('unticks the ticked items only', () => {
		expect(body(planGroupTick(mixed, 3, [3, 4], false, NOW)?.next)).toBe('- [ ] a ⭐\n- [ ] b ⏳ 2026-11-08\n');
	});
});

describe('planGroupDelete', () => {
	test("deletes items and headings, keeping a lone heading's items", () => {
		expect(body(planGroupDelete(TEXT, 3, [3, 6])?.next)).toBe('## B\n- [ ] b\n- [ ] c\n');
	});

	test('deletes a heading with its selected items', () => {
		expect(body(planGroupDelete(TEXT, 3, [6, 7])?.next)).toBe('- [ ] a\n## B\n- [ ] b\n');
	});

	test.each([
		['as is', (t: string) => t],
		['with CRLF', crlf],
		['without the final newline', (t: string) => t.replace(/\n$/, '')],
	])('a group delete undoes byte for byte, %s', (_, shape) => {
		for (const rows of [[3, 6], [6, 7]]) {
			const text = shape(TEXT);
			const plan = planGroupDelete(text, 3, rows);
			if (!plan) throw new Error('expected a delete');
			const history = new EditHistory();
			history.wrote(text, plan.next, plan.edit);
			expect(history.undo(plan.next)?.next).toBe(text);
		}
	});

	test('the undo takes the lines back where they were', () => {
		const plan = planGroupDelete(TEXT, 3, [3, 6]);
		if (!plan) throw new Error('expected a delete');
		const history = new EditHistory();
		history.wrote(TEXT, plan.next, plan.edit);
		const undo = history.undo(plan.next);
		if (!undo) throw new Error('expected an undo');
		expect(followLine(4, undo.edit)).toBe(5);
		expect(followLine(5, undo.edit)).toBe(7);
	});

	test('the undo maps lines back past an item with notes', () => {
		const text = FRONT + '- [ ] x\n- [ ] a\n  n1\n  n2\n- [ ] b\n';
		for (const rows of [[4], [4, 7]]) {
			const plan = planGroupDelete(text, 3, rows);
			if (!plan) throw new Error('expected a delete');
			const history = new EditHistory();
			history.wrote(text, plan.next, plan.edit);
			const undo = history.undo(plan.next);
			if (!undo) throw new Error('expected an undo');
			expect(followLine(3, undo.edit)).toBe(3);
		}
	});

	test('deleting one row is the single delete', () => {
		expect(planGroupDelete(TEXT, 3, [3])?.next).toBe(planItemDelete(TEXT, 3, 3)?.next);
		expect(planGroupDelete(TEXT, 3, [6])?.next).toBe(planHeadingDelete(TEXT, 3, 6)?.next);
	});

	test('returns null for a row that is gone', () => {
		expect(planGroupDelete(TEXT, 3, [3, 99])).toBeNull();
	});

	test('maps each line through a delete', () => {
		const editing = new ListEditing((t) => contentStartOf(splitLines(t)));
		editing.text = TEXT;
		const selection = new RowSelection(editing);
		selection.toggle(5);
		selection.toggle(7);
		const plan = planGroupDelete(TEXT, 3, [3, 6]);
		if (!plan) throw new Error('expected a delete');
		editing.applyOwn(plan.next, plan.edit);
		expect(selection.lines()).toEqual([4, 5]);
	});
});

describe('headingChoices', () => {
	test('lists the headings to move to', () => {
		expect(headingChoices(TEXT, 3)).toEqual([
			{ label: 'Top of the list', headingLine: null },
			{ label: 'B', headingLine: 4 },
			{ label: 'C', headingLine: 6 },
		]);
		const same = FRONT + '## F\n## G\n## F\n';
		expect(headingChoices(same, 3).map((choice) => choice.label)).toEqual(['Top of the list', 'F, 1 of 2', 'G', 'F, 2 of 2']);
	});
});

describe('countPhrase', () => {
	test('names a count of items and headings', () => {
		expect(countPhrase(5, 0)).toBe('5 items');
		expect(countPhrase(4, 1)).toBe('4 items and 1 heading');
		expect(countPhrase(1, 0)).toBe('1 item');
		expect(countPhrase(0, 2)).toBe('2 headings');
	});
});

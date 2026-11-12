import { describe, expect, test } from 'vitest';
import { ListEditing } from '../../src/core/editing';
import { ownEdit } from '../../src/core/follow';
import { splitLines } from '../../src/core/lines';
import { planSectionMove } from '../../src/core/list-actions';
import { RowSelection } from '../../src/core/selection';
import { contentStartOf } from './edit-helpers';

const TEXT = '---\nprincelists: true\n---\n- [ ] a\n## B\n- [ ] b\n## C\n- [ ] c\n';
const SHOWN = [3, 4, 5, 6, 7];

function selectionIn(text: string): { editing: ListEditing; selection: RowSelection } {
	const editing = new ListEditing((t) => contentStartOf(splitLines(t)));
	editing.text = text;
	return { editing, selection: new RowSelection(editing) };
}

describe('RowSelection', () => {
	test('toggle adds and removes a row and moves the anchor', () => {
		const { selection } = selectionIn(TEXT);
		selection.toggle(3);
		selection.toggle(7);
		expect(selection.lines()).toEqual([3, 7]);
		expect(selection.anchor).toBe(7);
		selection.toggle(3);
		expect(selection.lines()).toEqual([7]);
		expect(selection.anchor).toBe(3);
	});

	test('linesWith gives the selected lines for a row in a selection of two or more', () => {
		const { selection } = selectionIn(TEXT);
		selection.toggle(7);
		expect(selection.linesWith(7)).toBeNull();
		selection.toggle(3);
		expect(selection.linesWith(7)).toEqual([3, 7]);
		expect(selection.linesWith(5)).toBeNull();
	});

	test('selectRange selects the shown rows from the anchor', () => {
		const { selection } = selectionIn(TEXT);
		selection.setAnchor(4);
		selection.selectRange(6, SHOWN);
		expect(selection.lines()).toEqual([4, 5, 6]);
		selection.selectRange(3, SHOWN);
		expect(selection.lines()).toEqual([3, 4]);
	});

	test('a second range replaces the first and keeps rows chosen one at a time', () => {
		const { selection } = selectionIn(TEXT);
		selection.toggle(3);
		selection.toggle(6);
		selection.selectRange(7, SHOWN);
		expect(selection.lines()).toEqual([3, 6, 7]);
		selection.selectRange(5, SHOWN);
		expect(selection.lines()).toEqual([3, 5, 6]);
	});

	test('toggle keeps the range', () => {
		const { selection } = selectionIn(TEXT);
		selection.setAnchor(4);
		selection.selectRange(5, SHOWN);
		selection.toggle(7);
		expect(selection.lines()).toEqual([4, 5, 7]);
	});

	test("selectRange skips rows that aren't shown", () => {
		const { selection } = selectionIn(TEXT);
		selection.setAnchor(3);
		selection.selectRange(7, [3, 6, 7]);
		expect(selection.lines()).toEqual([3, 6, 7]);
	});

	test('selectRange with no anchor selects the row alone', () => {
		const { selection } = selectionIn(TEXT);
		selection.selectRange(5, SHOWN);
		expect(selection.lines()).toEqual([5]);
		expect(selection.anchor).toBe(5);
	});

	test("startWith selects the held row and the closed card's item, the held row the anchor", () => {
		const { selection } = selectionIn(TEXT);
		selection.startWith(5, 3);
		expect(selection.lines()).toEqual([3, 5]);
		expect(selection.anchor).toBe(5);
	});

	test('startWith drops the rows selected before', () => {
		const { selection } = selectionIn(TEXT);
		selection.toggle(7);
		selection.startWith(5, null);
		expect(selection.lines()).toEqual([5]);
		expect(selection.anchor).toBe(5);
	});

	test('addRangeTo selects the shown rows from the last row tapped and keeps the rows tapped before', () => {
		const { selection } = selectionIn(TEXT);
		selection.toggle(3);
		selection.toggle(5);
		selection.addRangeTo(7, SHOWN);
		expect(selection.lines()).toEqual([3, 5, 6, 7]);
	});

	test('addRangeTo with no shown anchor adds a selected row rather than removing it', () => {
		const { selection } = selectionIn(TEXT);
		selection.toggle(6);
		selection.toggle(4);
		selection.keepOnly(new Set([3, 5, 6, 7]));
		selection.addRangeTo(6, [3, 5, 6, 7]);
		expect(selection.lines()).toEqual([6]);
		expect(selection.anchor).toBe(6);
		selection.keepOnly(new Set([3, 5, 7]));
		selection.addRangeTo(7, [3, 5, 7]);
		expect(selection.lines()).toEqual([7]);
	});

	test('extend grows and shrinks the range from the anchor', () => {
		const { selection } = selectionIn(TEXT);
		selection.toggle(5);
		selection.extend(1, SHOWN);
		expect(selection.lines()).toEqual([5, 6]);
		selection.extend(1, SHOWN);
		expect(selection.lines()).toEqual([5, 6, 7]);
		selection.extend(1, SHOWN);
		expect(selection.lines()).toEqual([5, 6, 7]);
		selection.extend(-1, SHOWN);
		expect(selection.lines()).toEqual([5, 6]);
		selection.extend(-1, SHOWN);
		expect(selection.lines()).toEqual([5]);
		selection.extend(-1, SHOWN);
		expect(selection.lines()).toEqual([4, 5]);
	});

	test('extend does nothing with no anchor', () => {
		const { selection } = selectionIn(TEXT);
		selection.extend(1, SHOWN);
		expect(selection.lines()).toEqual([]);
	});

	test('keepOnly drops rows and an anchor no longer shown', () => {
		const { selection } = selectionIn(TEXT);
		selection.toggle(3);
		selection.toggle(5);
		selection.keepOnly(new Set([3]));
		expect(selection.lines()).toEqual([3]);
		expect(selection.anchor).toBeNull();
	});

	test('keepOnly ends a range whose far end is hidden', () => {
		const { selection } = selectionIn(TEXT);
		selection.setAnchor(3);
		selection.selectRange(5, SHOWN);
		selection.keepOnly(new Set([3, 4]));
		expect(selection.lines()).toEqual([3, 4]);
		expect(selection.anchor).toBe(3);
		selection.extend(1, [3, 4, 6, 7]);
		expect(selection.lines()).toEqual([3, 4]);
	});

	test("the selection follows the view's own edits", () => {
		const { editing, selection } = selectionIn(TEXT);
		selection.toggle(5);
		selection.toggle(6);
		const move = planSectionMove(TEXT, 3, 6, 4);
		if (!move) throw new Error('expected the move to change the text');
		editing.applyOwn(move.next, move.edit);
		expect(selection.lines()).toEqual([4, 7]);

		const { editing: other, selection: inserting } = selectionIn(TEXT);
		inserting.toggle(4);
		inserting.toggle(6);
		const inserted = TEXT.replace('- [ ] a\n', '- [ ] a\n- [ ] \n');
		other.applyOwn(inserted, ownEdit(4, TEXT, inserted, 'insert'));
		expect(inserting.lines()).toEqual([5, 7]);
	});

	test('a row whose line goes drops out', () => {
		const { editing, selection } = selectionIn(TEXT);
		selection.toggle(5);
		selection.toggle(7);
		const deleted = TEXT.replace('- [ ] b\n', '');
		editing.applyOwn(deleted, ownEdit(5, TEXT, deleted, 'delete'));
		expect(selection.lines()).toEqual([6]);
		expect(selection.size).toBe(1);
	});

	test('an outside change keeps the rows it can still find', () => {
		const { editing, selection } = selectionIn(TEXT);
		selection.toggle(5);
		selection.toggle(7);
		editing.outsideChange(TEXT.replace('- [ ] c', '- [ ] c2'));
		expect(selection.lines()).toEqual([5]);
	});
});

import { describe, expect, test } from 'vitest';
import { dropAt, moveFromDrawn, sectionDropAt, type ShownRow } from '../../src/core/drop';
import { ListEditing } from '../../src/core/editing';
import { planRemoval } from '../../src/core/empty-item';
import { splitLines } from '../../src/core/lines';
import { planItemInsert, planItemMove, type ItemPlace } from '../../src/core/list-actions';
import { contentStartOf } from './edit-helpers';

const heading = (line: number): ShownRow => ({ kind: 'heading', line });
const item = (line: number): ShownRow => ({ kind: 'item', line });
const untouched = (line: number): ShownRow => ({ kind: 'untouched', line });
const upper = (line: number) => ({ line, below: false });
const lower = (line: number) => ({ line, below: true });

describe('dropAt', () => {
	// a and b first in the list, then c and d under H.
	const shown = [item(2), item(3), heading(4), item(5), item(6)];

	test('in the lower half of an item, the drop line goes under it, and the item follows it', () => {
		expect(dropAt(shown, 5, lower(2))).toEqual({ place: { after: 2 }, line: 2, above: false });
		expect(dropAt(shown, 2, lower(6))).toEqual({ place: { after: 6 }, line: 6, above: false });
	});
	test('in the upper half of an item, the drop line goes under the row above it', () => {
		expect(dropAt(shown, 5, upper(3))).toEqual({ place: { after: 2 }, line: 2, above: false });
		expect(dropAt(shown, 2, upper(5))).toEqual({ place: { firstUnder: 4 }, line: 4, above: false });
	});
	test('in the lower half of a heading, the item goes first under it', () => {
		expect(dropAt(shown, 2, lower(4))).toEqual({ place: { firstUnder: 4 }, line: 4, above: false });
	});
	test('in the upper half of a heading, the item goes after the last item above it', () => {
		expect(dropAt(shown, 5, upper(4))).toEqual({ place: { after: 3 }, line: 3, above: false });
	});
	test('at the top of the list, the item goes first, with the drop line above the first row', () => {
		expect(dropAt(shown, 5, upper(2))).toEqual({ place: 'first', line: 2, above: true });
		expect(dropAt([heading(0), item(1), heading(2), item(3)], 3, upper(0))).toEqual({ place: 'first', line: 0, above: true });
	});
	test('a heading without items takes the drop line in the upper half of the heading after it', () => {
		const empty = [heading(0), heading(1), item(2)];
		expect(dropAt(empty, 2, upper(1))).toEqual({ place: { firstUnder: 0 }, line: 0, above: false });
	});
	test('untouched rows are passed over: the drop line goes under the item or heading above them', () => {
		const withText = [heading(0), item(1), untouched(3), item(6), heading(8), item(9)];
		expect(dropAt(withText, 9, upper(3))).toEqual({ place: { after: 1 }, line: 1, above: false });
		expect(dropAt(withText, 9, lower(3))).toEqual({ place: { after: 1 }, line: 1, above: false });
		expect(dropAt([heading(0), untouched(1), item(3)], 3, upper(1))).toBeNull();
	});
	test('at the top of a list whose first item is hidden, the drop line goes above the untouched row first shown', () => {
		expect(dropAt([untouched(3), item(5), heading(7), item(8)], 8, upper(3))).toEqual({ place: 'first', line: 3, above: true });
	});
	test('no drop where the item already shows: on itself, under the row above it, or past untouched rows to it', () => {
		for (const over of [upper(5), lower(5), upper(6), lower(4)]) expect(dropAt(shown, 5, over)).toBeNull();
		expect(dropAt(shown, 2, upper(2))).toBeNull();
		expect(dropAt(shown, 2, upper(3))).toBeNull();
		const withText = [item(0), untouched(2), item(4)];
		expect(dropAt(withText, 4, lower(2))).toBeNull();
		expect(dropAt(withText, 4, lower(0))).toBeNull();
	});
	test('a hidden row between the item and the one above it changes nothing: that drop is no drop', () => {
		// The done item on line 1 is hidden, so b shows right under a.
		expect(dropAt([item(0), item(2)], 2, lower(0))).toBeNull();
	});
	test("null over a line that isn't shown, or for an item that isn't", () => {
		expect(dropAt(shown, 5, lower(9))).toBeNull();
		expect(dropAt(shown, 9, lower(2))).toBeNull();
	});
});

describe('sectionDropAt', () => {
	// Items before any heading, then sections 2 and 4, and text at the end.
	const shown = [item(1), heading(2), item(3), heading(4), item(5), untouched(6)];

	test('the section goes before the first heading at or after the gap', () => {
		expect(sectionDropAt(shown, 4, upper(2))).toEqual({ before: 2, line: 2, above: true });
		expect(sectionDropAt(shown, 4, lower(1))).toEqual({ before: 2, line: 2, above: true });
	});
	test('never above the items before the first heading', () => {
		expect(sectionDropAt(shown, 4, upper(1))).toEqual({ before: 2, line: 2, above: true });
	});
	test('past the last heading, the section goes to the end, with the line under the last row', () => {
		expect(sectionDropAt(shown, 2, lower(6))).toEqual({ before: null, line: 6, above: false });
	});
	test('a drop where the section already is gives null', () => {
		expect(sectionDropAt(shown, 2, upper(4))).toBeNull();
		expect(sectionDropAt(shown, 2, lower(3))).toBeNull();
		expect(sectionDropAt(shown, 2, upper(2))).toBeNull();
		expect(sectionDropAt(shown, 4, upper(3))).toBeNull();
		expect(sectionDropAt(shown, 4, lower(5))).toBeNull();
	});
});

describe('moveFromDrawn', () => {
	// a and b first in the list, then c and d under H.
	const drawn = [item(2), item(3), heading(4), item(5), item(6)];

	test('with every row on the line it was drawn on, the move is the drop as aimed', () => {
		expect(moveFromDrawn(drawn, [2, 3, 4, 5, 6], 5, { after: 2 })).toEqual({ from: 5, to: { after: 2 } });
		expect(moveFromDrawn(drawn, [2, 3, 4, 5, 6], 2, { firstUnder: 4 })).toEqual({ from: 2, to: { firstUnder: 4 } });
		expect(moveFromDrawn(drawn, [2, 3, 4, 5, 6], 5, 'first')).toEqual({ from: 5, to: 'first' });
	});
	test('the dragged row and the place follow their lines to where they are now', () => {
		expect(moveFromDrawn(drawn, [1, 2, 3, 4, 5], 5, { after: 2 })).toEqual({ from: 4, to: { after: 1 } });
		expect(moveFromDrawn(drawn, [1, 2, 3, 4, 5], 2, { firstUnder: 4 })).toEqual({ from: 1, to: { firstUnder: 3 } });
	});
	test('a place after a row that went goes after the nearest row above it that is still there', () => {
		expect(moveFromDrawn(drawn, [2, null, 3, 4, 5], 6, { after: 3 })).toEqual({ from: 5, to: { after: 2 } });
		expect(moveFromDrawn(drawn, [2, 3, 4, null, 5], 6, { after: 5 })).toEqual({ from: 5, to: { firstUnder: 4 } });
		expect(moveFromDrawn(drawn, [null, 2, 3, 4, 5], 5, { after: 2 })).toEqual({ from: 4, to: 'first' });
	});
	test('null when the dragged row went, or the dragged row or the place is on a line not drawn', () => {
		expect(moveFromDrawn(drawn, [2, 3, 4, null, 6], 5, { after: 2 })).toBeNull();
		expect(moveFromDrawn(drawn, [2, 3, 4, 5, 6], 9, { after: 2 })).toBeNull();
		expect(moveFromDrawn(drawn, [2, 3, 4, 5, 6], 5, { after: 9 })).toBeNull();
	});
});

// A list block's drag, in its order: the lift tracks every drawn row's line, then the save of the
// closed field runs, removing the empty new item it added, while the block keeps the rows as drawn.
describe('a drag in a list block', () => {
	const start = (text: string) => contentStartOf(splitLines(text));
	const titles = (text: string) => splitLines(text).slice(3).map((line) => line.text.slice(6));
	const groceries = '---\nprincelists: true\n---\n- [ ] Milk\n- [ ] Eggs\n- [ ] Bread\n';

	// Draws the items after an insert of an empty item at `newAt`, when given, then lifts the item drawn
	// on `lifted` and removes the empty item. Returns the titles after the drop's move, or null for none.
	function dragAfterNewItem(newAt: ItemPlace | null, lifted: number, over: { line: number; below: boolean }): string[] | null {
		const editing = new ListEditing(start);
		editing.text = groceries;
		const insert = newAt === null ? null : planItemInsert(groceries, start(groceries), newAt);
		if (insert) editing.applyOwn(insert.next, insert.edit);
		const drawn: ShownRow[] = titles(editing.text).map((_, i) => item(i + 3));
		const tracked = drawn.map((row) => editing.track(row.line));
		if (insert) {
			const removal = planRemoval(editing.text, start(editing.text), insert.line, insert.inserted);
			if (removal) editing.applyOwn(removal.next, removal.edit);
		}
		const drop = dropAt(drawn, lifted, over);
		const move = drop && moveFromDrawn(drawn, tracked.map((row) => row.line), lifted, drop.place);
		const moved = move && planItemMove(editing.text, start(editing.text), move.from, move.to);
		return moved ? titles(moved.next) : null;
	}

	test('a new item first, then Bread dropped on the upper half of Milk: Bread goes before Milk', () => {
		expect(dragAfterNewItem('first', 6, upper(4))).toEqual(['Bread', 'Milk', 'Eggs']);
	});
	test('a new item first, then Bread dropped on the lower half of Milk: Bread goes between Milk and Eggs', () => {
		expect(dragAfterNewItem('first', 6, lower(4))).toEqual(['Milk', 'Bread', 'Eggs']);
	});
	test('a new item after Eggs, then Milk dropped below it, on the lower half of Bread: Milk goes last', () => {
		expect(dragAfterNewItem({ after: 4 }, 3, lower(6))).toEqual(['Eggs', 'Bread', 'Milk']);
	});
	test('with no field open, the drop lands where it always did', () => {
		expect(dragAfterNewItem(null, 5, upper(3))).toEqual(['Bread', 'Milk', 'Eggs']);
		expect(dragAfterNewItem(null, 5, lower(3))).toEqual(['Milk', 'Bread', 'Eggs']);
		expect(dragAfterNewItem(null, 3, lower(5))).toEqual(['Eggs', 'Bread', 'Milk']);
	});
});

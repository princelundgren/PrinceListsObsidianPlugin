import { describe, expect, test } from 'vitest';
import { CollapsedHeadings, collapseChoices, sectionHeadingOf } from '../../src/core/collapsed';
import { ListEditing } from '../../src/core/editing';
import { ownEdit } from '../../src/core/follow';
import { planSectionMove } from '../../src/core/list-actions';
import { splitLines } from '../../src/core/lines';
import { contentStartOf, list } from './edit-helpers';

const TEXT = '---\nprincelists: true\n---\n- [ ] a\n## B\n- [ ] b\n## C\n- [ ] c\n';

function collapsedIn(text: string): { editing: ListEditing; collapsed: CollapsedHeadings } {
	const editing = new ListEditing((t) => contentStartOf(splitLines(t)));
	editing.text = text;
	return { editing, collapsed: new CollapsedHeadings(editing) };
}

describe('CollapsedHeadings', () => {
	test('toggle collapses a heading and expands it again', () => {
		const { collapsed } = collapsedIn(TEXT);
		collapsed.toggle(4);
		expect(collapsed.lines()).toEqual(new Set([4]));
		collapsed.toggle(4);
		expect(collapsed.lines()).toEqual(new Set());
	});

	test("a collapsed heading follows the view's own edits", () => {
		const { editing, collapsed } = collapsedIn(TEXT);
		collapsed.toggle(4);
		const inserted = TEXT.replace('- [ ] a\n', '- [ ] a\n- [ ] \n');
		editing.applyOwn(inserted, ownEdit(4, TEXT, inserted, 'insert'));
		expect(collapsed.lines()).toEqual(new Set([5]));

		const { editing: other, collapsed: moving } = collapsedIn(TEXT);
		moving.toggle(6);
		const move = planSectionMove(TEXT, 3, 6, 4);
		if (!move) throw new Error('expected the move to change the text');
		other.applyOwn(move.next, move.edit);
		expect(moving.lines()).toEqual(new Set([4]));
	});

	test('a collapsed heading follows outside changes, and goes with its heading', () => {
		const { editing, collapsed } = collapsedIn(TEXT);
		collapsed.toggle(4);
		editing.outsideChange(TEXT.replace('- [ ] a\n', '- [ ] a\nText\n'));
		expect(collapsed.lines()).toEqual(new Set([5]));
		editing.outsideChange(editing.text.replace('## B\n', ''));
		expect(collapsed.lines()).toEqual(new Set());
	});

	test('collapseAll collapses every heading given, keeping those already collapsed', () => {
		const { editing, collapsed } = collapsedIn(TEXT);
		collapsed.toggle(4);
		collapsed.collapseAll([4, 6]);
		expect(collapsed.lines()).toEqual(new Set([4, 6]));
		editing.outsideChange(TEXT.replace('- [ ] a\n', '- [ ] a\nText\n'));
		expect(collapsed.lines()).toEqual(new Set([5, 7]));
		collapsed.toggle(5);
		expect(collapsed.lines()).toEqual(new Set([7]));
	});

	test('reset and clear expand every heading', () => {
		const { editing, collapsed } = collapsedIn(TEXT);
		collapsed.toggle(4);
		editing.reset();
		expect(collapsed.lines()).toEqual(new Set());
		collapsed.toggle(6);
		collapsed.clear();
		expect(collapsed.lines()).toEqual(new Set());
	});
});

test('sectionHeadingOf gives the heading of the section holding a line, or null for the top', () => {
	const { model } = list(TEXT);
	expect(sectionHeadingOf(model, 5)).toBe(4);
	expect(sectionHeadingOf(model, 7)).toBe(6);
	expect(sectionHeadingOf(model, 3)).toBeNull();
});

describe('collapseChoices', () => {
	test('every heading open offers only collapse', () => {
		expect(collapseChoices([2, 5], new Set())).toEqual({ canCollapse: true, canExpand: false });
	});
	test('every heading collapsed offers only expand', () => {
		expect(collapseChoices([2, 5], new Set([2, 5]))).toEqual({ canCollapse: false, canExpand: true });
	});
	test('some collapsed offers both', () => {
		expect(collapseChoices([2, 5], new Set([5]))).toEqual({ canCollapse: true, canExpand: true });
	});
	test('a collapsed line that is no longer a heading doesn\'t count', () => {
		expect(collapseChoices([2], new Set([2, 4]))).toEqual({ canCollapse: false, canExpand: true });
		expect(collapseChoices([], new Set([4]))).toEqual({ canCollapse: false, canExpand: false });
	});
});

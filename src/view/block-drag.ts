import { Notice, Platform } from 'obsidian';
import { planItemMove, type ItemPlace } from '../core/list-actions';
import { contentStartLine } from '../obsidian/marker';
import { followPlace } from './add-button';
import { closeBlockField } from './block-fields';
import { targetOf } from './dom';
import type { RowDragHost } from './drag-host';
import { enableMouseDrag } from './drag-mouse';
import { enableTouchDrag } from './drag-touch';
import type { ListBlock } from './list-block';
import { ITEM_CLASS } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, tryEdit } from './write';

// Items drag within the block, headings don't, and nothing scrolls at the edges: the note's scroller
// is Obsidian's (spec, "A list inside another note").
export function blockDragHost(block: ListBlock): RowDragHost {
	return {
		component: block,
		rowsEl: block.rowsEl,
		edgeScroll: null,
		dragsHeadings: false,
		get swallowNextClick() {
			return block.swallowNextClick;
		},
		set swallowNextClick(value: boolean) {
			block.swallowNextClick = value;
		},
		beforeLift: () => closeBlockField(block, true),
		// A drag holds its row from track to untrack. The block doesn't draw in between, so a field the
		// lift closed and saved can't end the drag; it draws once the drag is over.
		// Out-of-date rows give a line already gone, so the drag ends without a drop.
		track: (line) => {
			block.dragging = true;
			return block.rowsMatchText() ? block.editing.track(line) : { line: null };
		},
		untrack: (tracked) => {
			block.editing.untrack(tracked);
			block.dragging = false;
			block.drawIfChanged();
		},
		drop: (line, drop) => {
			if ('item' in drop) queueBlockMove(block, line, drop.item.place);
		},
	};
}

export function enableBlockDrag(block: ListBlock): void {
	const host = block.dragHost();
	enableMouseDrag(host);
	if (!Platform.isMobile) return;
	enableTouchDrag(host);
	// In the capture phase, as in the list view: a hold on a row opens no menu, and the tap that ends a
	// hold or a lift isn't a click.
	const { rowsEl } = block;
	block.registerDomEvent(
		rowsEl,
		'contextmenu',
		(evt) => {
			const target = targetOf(evt);
			if (!target || target.closest('textarea') || !target.closest(`.${ITEM_CLASS}`)) return;
			evt.preventDefault();
			evt.stopPropagation();
			block.swallowNextClick = true;
		},
		{ capture: true },
	);
	block.registerDomEvent(
		rowsEl,
		'click',
		(evt) => {
			if (!block.swallowNextClick) return;
			block.swallowNextClick = false;
			evt.preventDefault();
			evt.stopPropagation();
		},
		{ capture: true },
	);
	// A hold that sent no click must not eat a later tap.
	block.registerDomEvent(rowsEl, 'touchstart', () => (block.swallowNextClick = false), { capture: true });
}

// As the list view's queueMove: the item and its place follow the edits that land before the move runs.
function queueBlockMove(block: ListBlock, line: number, place: ItemPlace): void {
	const file = block.file;
	const item = block.editing.track(line);
	const anchor = place === 'first' ? null : block.editing.track('after' in place ? place.after : place.firstUnder);
	void block.enqueue(async () => {
		try {
			if (block.file !== file) return;
			const to = followPlace(place, anchor?.line ?? null);
			if (item.line === null || !to) {
				new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			const from = item.line;
			const text = block.editing.text;
			const moved = tryEdit(() => planItemMove(text, contentStartLine(text), from, to));
			if (moved && (await block.write(moved.next, text, moved.edit)) === 'written' && !block.field) block.drawIfChanged();
		} finally {
			block.editing.untrack(item);
			if (anchor) block.editing.untrack(anchor);
		}
	});
}

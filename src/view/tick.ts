import { Notice } from 'obsidian';
import { itemRow } from '../core/display';
import { toggleItem } from '../core/edit-items';
import type { OwnEdit } from '../core/follow';
import { toggleLine } from '../core/item-line';
import { joinLines, type Line } from '../core/lines';
import { itemAt } from '../core/parse';
import type { PrinceListView } from './list-view';
import { lineOf, showDone } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, tryEdit, writeAction } from './write';

// A tap on an item's box. It waits on the view's write queue, and its line follows the view's own
// edits meanwhile, even when a redraw replaced its row.
export function queueTick(view: PrinceListView, row: HTMLElement): void {
	const line = lineOf(row);
	if (line !== null) queueTickAt(view, line, row, null);
}

// Ticks the item at `line` when `done`, unticks it when not, and does nothing when it already is so;
// null switches it whichever way it is. `row`, when it still stands for that item, shows the change.
export function queueTickAt(view: PrinceListView, line: number, row: HTMLElement | null, done: boolean | null): void {
	const pending = view.editing.track(line);
	const seen = view.outsideChanges;
	const file = view.file;
	void view.enqueue(async () => {
		try {
			// With another file in the view, or none, the tap is moot and nothing need be said.
			if (view.viewClosed || view.file !== file) return;
			await tick(view, row, pending, seen, done);
		} finally {
			view.editing.untrack(pending);
		}
	});
}

// Parsed from the view's text, which the write's guard expects, not taken from the last render: an
// earlier tick may have changed the text since, and an edit of the older lines would undo it.
async function tick(view: PrinceListView, row: HTMLElement | null, pending: { line: number | null }, seen: number, done: boolean | null): Promise<void> {
	for (let attempt = 0; attempt < 2; attempt++) {
		// An outside change while this tap waited may have moved lines, and ticking the wrong item is
		// worse than dropping the tap. A silent drop would look like a lost tick.
		if (view.outsideChanges !== seen) {
			new Notice(CHANGED_ELSEWHERE_NOTICE);
			return;
		}
		const titleLine = pending.line;
		if (titleLine === null) return;
		const text = view.text;
		const { lines, model } = view.parse();
		const item = itemAt(model, titleLine);
		const now = new Date();
		if (!item || done === itemRow((lines[titleLine] as Line).text, titleLine, now).done) return;
		const edited = tryEdit(() => toggleItem(lines, item, now));
		if (!edited) return;
		// A title field with focus makes the same tick to the line it saved (syncTitleField).
		const edit: OwnEdit = { start: titleLine, delta: 0, kind: 'change', retitle: (line) => toggleLine(line, now) };
		const result = await writeAction(view, joinLines(edited), text, undefined, edit);
		if (result === 'written') {
			// Obsidian's echo of this write returns early in setViewData, so the row is updated here. A
			// tick moves no line, so the row still stands for this item. A redraw during the write,
			// such as "Show archived", drew from the text before the tick, so the view redraws again.
			if (row?.isConnected && lineOf(row) === titleLine) showDone(row, itemRow((edited[titleLine] as Line).text, titleLine, now));
			else view.render();
			return;
		}
		// Refused: once more on the new text if typing landed while it wrote. A write that failed isn't
		// run again: typing since may have kept the tick in the view, and a second tick would undo it.
		if (result === 'failed' || view.text === text) return;
	}
}

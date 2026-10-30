import { Notice } from 'obsidian';
import { planNotesLineTick } from '../core/checklist';
import type { TrackedLine } from '../core/editing';
import type { PlannedLineEdit } from '../core/list-actions';
import { contentStartLine } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import type { NotesSource } from './notes-source';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, writePlanned } from './write';

/**
 * Ticks line `index` of the notes in `source`, from a box the notes editor drew while it hasn't focus:
 * the list's tick, as a row's is (spec, "Checkboxes"). The editor shows the file once it lands. `shown`
 * is what the editor holds, which is the notes as parsed while it hasn't focus; when it isn't, its
 * lines aren't the file's, and nothing is written.
 */
export function notesBoxClick(view: PrinceListView, source: NotesSource, shown: string, index: number): void {
	const notes = source.read();
	const titleLine = source.kind === 'item' ? view.selected : null;
	const line = (notes?.start ?? 0) + index;
	const lineText = view.lines()[line]?.text;
	if (notes?.markdown !== shown || (source.kind === 'item' && titleLine === null) || lineText === undefined) {
		new Notice(CHANGED_ELSEWHERE_NOTICE);
		return;
	}
	queueBoxTick(view, titleLine, (text, pending) => {
		const contentStart = contentStartLine(text);
		if (titleLine === null) return planNotesLineTick(text, contentStart, 'listNote', line, lineText);
		// The item's notes move with its title line while the tick waits.
		return pending?.line == null ? null : planNotesLineTick(text, contentStart, pending.line, pending.line + line - titleLine, lineText);
	});
}

// The tick waits its turn behind the list's other writes, with the item at `titleLine` tracked.
function queueBoxTick(view: PrinceListView, titleLine: number | null, plan: (text: string, pending: TrackedLine | null) => PlannedLineEdit | null): void {
	const seen = view.outsideChanges;
	enqueueAt(view, titleLine, async (pending) => {
		let planned = true;
		const written = await writePlanned(view, (text) => {
			// An outside change may have moved the lines, and ticking the wrong one is worse than none.
			const edit = view.outsideChanges === seen ? plan(text, pending) : null;
			planned = edit !== null;
			return edit;
		});
		if (!planned) new Notice(CHANGED_ELSEWHERE_NOTICE);
		// Obsidian's echo of the write returns early in setViewData, so the view draws the change.
		else if (written) view.render();
	});
}

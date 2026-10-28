import { Notice } from 'obsidian';
import { planChecklistTick, planListNoteTick } from '../core/checklist';
import type { TrackedLine } from '../core/editing';
import type { PlannedLineEdit } from '../core/list-actions';
import { contentStartLine } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import type { NotesHost } from './notes-host';
import { boxLine } from './note-pieces';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, writePlanned } from './write';

// A box in the open card's notes or the list note ticks its own line (spec, "Checklists"). The box
// shows the file, so it changes once the write lands. An embed can render more boxes after the first
// check, and then the boxes no longer line up with their piece's lines: the box is disabled and
// nothing is written.
export function checklistClick(view: PrinceListView, host: NotesHost, box: HTMLInputElement, evt: MouseEvent): void {
	evt.preventDefault();
	const titleLine = host.kind === 'card' ? view.selected : null;
	if (host.kind === 'card' && titleLine === null) return;
	const checklist = host.notes()?.checklist ?? null;
	const line = boxLine(box, checklist, host.range());
	const index = checklist?.findIndex((entry) => entry.line === line) ?? -1;
	const lineText = view.lines()[line ?? -1]?.text;
	if (index < 0 || lineText === undefined) {
		box.disabled = true;
		return;
	}
	const seen = view.outsideChanges;
	enqueueAt(view, titleLine, async (pending) => {
		let planned = true;
		const written = await writePlanned(view, (text) => {
			// An outside change may have moved the lines, and ticking the wrong one is worse than none.
			const plan = view.outsideChanges === seen ? planTick(host.kind, text, pending, index, lineText) : null;
			planned = plan !== null;
			return plan;
		});
		if (!planned) new Notice(CHANGED_ELSEWHERE_NOTICE);
		// Obsidian's echo of the write returns early in setViewData, so the view draws the change.
		else if (written) view.render();
	});
}

// A card's box is found from its item's line, which `item` follows while the tick waits; the list
// note's from the note itself.
function planTick(kind: NotesHost['kind'], text: string, item: TrackedLine | null, index: number, lineText: string): PlannedLineEdit | null {
	const contentStart = contentStartLine(text);
	if (kind === 'listNote') return planListNoteTick(text, contentStart, index, lineText);
	return item?.line == null ? null : planChecklistTick(text, contentStart, item.line, index, lineText);
}

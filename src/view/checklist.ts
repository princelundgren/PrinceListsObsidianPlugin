import { Notice } from 'obsidian';
import { checklistOf, planChecklistTick } from '../core/checklist';
import { itemAt } from '../core/parse';
import { contentStartLine } from '../obsidian/marker';
import { CARD_NOTES_CLASS } from './card';
import type { PrinceListView } from './list-view';
import { boxLine } from './note-pieces';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, writePlanned } from './write';

// A box in the open card's notes ticks its own line (spec, "Checklists"). The box shows the file, so
// it changes once the write lands. An embed can render more boxes after the first check, and then
// the boxes no longer line up with their piece's lines: the box is disabled and nothing is written.
export function checklistClick(view: PrinceListView, box: HTMLInputElement, evt: MouseEvent): void {
	evt.preventDefault();
	const titleLine = view.selected;
	if (titleLine === null || !box.closest(`.${CARD_NOTES_CLASS}`)) return;
	const { lines, model } = view.parse();
	const item = itemAt(model, titleLine);
	const checklist = item ? checklistOf(lines, item) : [];
	const line = boxLine(box, checklist, view.editing.notesPieceRange());
	const index = checklist?.findIndex((entry) => entry.line === line) ?? -1;
	const lineText = lines[line ?? -1]?.text;
	if (index < 0 || lineText === undefined) {
		box.disabled = true;
		return;
	}
	const seen = view.outsideChanges;
	enqueueAt(view, titleLine, async (pending) => {
		let planned = true;
		const written = await writePlanned(view, (text) => {
			// An outside change may have moved the lines, and ticking the wrong one is worse than none.
			const line = view.outsideChanges === seen ? pending?.line : null;
			const plan = line == null ? null : planChecklistTick(text, contentStartLine(text), line, index, lineText);
			planned = plan !== null;
			return plan;
		});
		if (!planned) new Notice(CHANGED_ELSEWHERE_NOTICE);
		// Obsidian's echo of the write returns early in setViewData, so the view draws the change.
		else if (written) view.render();
	});
}

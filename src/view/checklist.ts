import { Notice } from 'obsidian';
import { checklistOf, planChecklistTick } from '../core/checklist';
import { itemAt } from '../core/parse';
import { contentStartLine } from '../obsidian/marker';
import { CARD_NOTES_CLASS } from './card';
import type { PrinceListView } from './list-view';
import { NOTES_CHECKBOX_SELECTOR } from './notes';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, writePlanned } from './write';

// A box in the open card's notes ticks its own line (spec, "Checklists"). The box shows the file, so
// it changes once the write lands. An embed can render more boxes after the first check, and then
// the boxes no longer line up with the lines: all are disabled and nothing is written.
export function checklistClick(view: PrinceListView, box: HTMLInputElement, evt: MouseEvent): void {
	evt.preventDefault();
	const titleLine = view.selected;
	const notes = box.closest(`.${CARD_NOTES_CLASS}`);
	if (titleLine === null || !notes) return;
	const boxes = Array.from(notes.querySelectorAll<HTMLInputElement>(NOTES_CHECKBOX_SELECTOR));
	const { lines, model } = view.parse();
	const item = itemAt(model, titleLine);
	const checklist = item ? checklistOf(lines, item) : [];
	if (!checklist || boxes.length !== checklist.length) {
		for (const each of boxes) each.disabled = true;
		return;
	}
	const index = boxes.indexOf(box);
	const lineText = lines[checklist[index]?.line ?? -1]?.text;
	if (lineText === undefined) return;
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

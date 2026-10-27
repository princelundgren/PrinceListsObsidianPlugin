import { Notice } from 'obsidian';
import { headingText } from '../core/display';
import { planHeadingRemoval, saveHeadingName, type HeadingFieldStart, type HeadingSave } from '../core/heading-field';
import { planHeadingInsert, type HeadingPlace } from '../core/list-actions';
import { contentStartLine } from '../obsidian/marker';
import { fitHeight } from './dom';
import { FIELD_CLASS } from './fields';
import type { PrinceListView } from './list-view';
import { buildHeading, HEADING_CLASS, LINE_ATTR } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, writePlanned } from './write';

export const HEADING_FIELD_CLASS = 'princelists-heading-field';
const NAME_REFUSED_NOTICE = "That name can't be used for this heading.";

/** The open heading field. A new one's heading was added for it, and goes again unless it gets a name. */
export interface HeadingField extends HeadingFieldStart {
	el: HTMLTextAreaElement;
	/** The line it opened on, where a redraw keeps it once its heading is gone. */
	openedAt: number;
	isNew: boolean;
}

// New heading below: an empty heading, then the field on it (spec, "Item actions").
export function addHeading(view: PrinceListView, place: HeadingPlace): void {
	const anchor = 'afterItem' in place ? place.afterItem : place.afterSection;
	enqueueAt(view, anchor, async (pending) => {
		const added = await writePlanned(view, (text) => {
			const line = pending?.line ?? null;
			if (line === null) return null;
			return planHeadingInsert(text, contentStartLine(text), 'afterItem' in place ? { afterItem: line } : { afterSection: line });
		});
		if (added) openHeadingField(view, added.line, true);
	});
}

// Rename heading, and New heading below once its heading is written: a field in place of the heading
// row, holding the heading's raw content, with the cursor at its end. Its heading's line is tracked
// until the field's write has run.
export function openHeadingField(view: PrinceListView, line: number, isNew = false): void {
	// A field still open saves as on any blur.
	view.headingField?.el.blur();
	const el = createEl('textarea', { cls: [FIELD_CLASS, HEADING_FIELD_CLASS], attr: { rows: 1, placeholder: 'Heading' } });
	const before = headingText(view.lines(), line);
	const field: HeadingField = { el, heading: view.editing.track(line), openedAt: line, before, isNew };
	el.value = field.before;
	view.headingField = field;
	const heading = view.contentEl.querySelector<HTMLElement>(`.${HEADING_CLASS}[${LINE_ATTR}="${line}"]`);
	if (heading) {
		view.dropBlock(heading);
		heading.replaceWith(el);
	} else {
		view.render();
	}
	fitHeight(el);
	el.focus();
	el.setSelectionRange(el.value.length, el.value.length);
}

// Enter saves, and a name that can't be used keeps the field open. Escape cancels, and the blur that
// follows doesn't save.
export function headingFieldKey(view: PrinceListView, target: HTMLElement, key: 'Enter' | 'Escape'): void {
	const field = view.headingField;
	if (field?.el !== target) return;
	if (key === 'Enter') commit(view, field, true);
	else closeField(view, field, null);
}

export function headingFieldBlur(view: PrinceListView, target: HTMLElement): void {
	const field = view.headingField;
	if (field?.el === target) commit(view, field, false);
}

function commit(view: PrinceListView, field: HeadingField, keepIfRefused: boolean): void {
	const name = field.el.value;
	// Decided now, so a refused name can keep the field open; closeField plans the write again later.
	const save = saveHeadingName(view.text, contentStartLine(view.text), field, name);
	tell(save);
	if (save.kind === 'refused' && keepIfRefused) return;
	closeField(view, field, save.kind === 'write' ? name : null);
}

function tell(save: HeadingSave): void {
	if (save.kind === 'refused') new Notice(NAME_REFUSED_NOTICE);
	else if (save.kind === 'lost') new Notice(CHANGED_ELSEWHERE_NOTICE);
}

// Writes `name`, or, with none, removes a new heading again: a cancel, with no Undo (spec, "Selecting
// and adding"). Both are worked out again on the text as it is when the write's turn comes. The heading
// row comes back once that has landed.
function closeField(view: PrinceListView, field: HeadingField, name: string | null): void {
	view.headingField = null;
	if (field.el.doc.activeElement === field.el) field.el.blur();
	if (name === null && !field.isNew) {
		showHeading(view, field, null, false);
		view.editing.untrack(field.heading);
		return;
	}
	enqueueAt(view, null, async () => {
		try {
			await writeField(view, field, name);
		} finally {
			view.editing.untrack(field.heading);
		}
	});
}

async function writeField(view: PrinceListView, field: HeadingField, name: string | null): Promise<void> {
	if (name === null) {
		const removed = await writePlanned(view, (text) => planHeadingRemoval(text, contentStartLine(text), field));
		if (removed && field.el.isConnected) field.el.remove();
		else showHeading(view, field, null, removed !== null);
		return;
	}
	let save: HeadingSave = { kind: 'none' };
	const written = await writePlanned(view, (text) => {
		save = saveHeadingName(text, contentStartLine(text), field, name);
		return save.kind === 'write' ? save : null;
	});
	if (!written) tell(save);
	showHeading(view, field, written?.line ?? null, written !== null);
}

// The heading row in place of the closed field, as the text now reads. `line` is where a write left the
// heading; otherwise it is the field's tracked line. Without one, or when a redraw has already
// replaced the field after a write, the whole list is drawn again.
function showHeading(view: PrinceListView, field: HeadingField, line: number | null, wrote: boolean): void {
	if (!field.el.isConnected) {
		if (wrote) view.render();
		return;
	}
	const lines = view.lines();
	const at = line ?? field.heading.line;
	if (at === null || !view.parse().model.sections.some((section) => section.headingLine === at)) {
		view.render();
		return;
	}
	field.el.replaceWith(buildHeading(view, { line: at, text: headingText(lines, at) }, view.blocks));
}

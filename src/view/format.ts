import { setIcon } from 'obsidian';
import { formatSelection, type Format, type FormatEdit } from '../core/format';
import { changeField } from './field-undo';

export const FORMAT_BAR_CLASS = 'princelists-format-bar';
const ACTION_ATTR = 'data-format';

/** What a bar button does: a format in the notes editor, or Add link, which asks for a note first. */
export type BarAction = Format | 'noteLink';

const GROUPS: readonly (readonly { action: BarAction; icon: string; label: string }[])[] = [
	[
		{ action: 'bold', icon: 'bold', label: 'Bold' },
		{ action: 'italic', icon: 'italic', label: 'Italic' },
		{ action: 'strikethrough', icon: 'strikethrough', label: 'Strikethrough' },
		{ action: 'underline', icon: 'underline', label: 'Underline' },
	],
	[
		{ action: 'checklist', icon: 'check-square', label: 'Task list' },
		{ action: 'bulleted', icon: 'list', label: 'Bullet list' },
		{ action: 'numbered', icon: 'list-ordered', label: 'Numbered list' },
		{ action: 'noteLink', icon: 'link', label: 'Add link' },
		{ action: 'link', icon: 'external-link', label: 'Add external link' },
		{ action: 'code', icon: 'code-2', label: 'Code' },
		{ action: 'codeBlock', icon: 'code', label: 'Code block' },
	],
];
const ACTIONS = GROUPS.flat().map((button) => button.action);

// Shown right under `after`, a notes editor.
export function buildFormatBar(after: HTMLElement): void {
	const bar = createDiv({ cls: FORMAT_BAR_CLASS });
	after.after(bar);
	for (const group of GROUPS) {
		const groupEl = bar.createDiv({ cls: 'princelists-format-group' });
		for (const { action, icon, label } of group) {
			// Tab would move focus out of the notes, which closes them; the bar is for pointer and touch.
			setIcon(groupEl.createEl('button', { attr: { 'aria-label': label, [ACTION_ATTR]: action, tabindex: '-1' } }), icon);
		}
	}
}

// The action a click or press on the bar asks for, or null when it isn't on one of its buttons.
export function barActionAt(target: HTMLElement): BarAction | null {
	const action = target.closest(`.${FORMAT_BAR_CLASS} [${ACTION_ATTR}]`)?.getAttr(ACTION_ATTR);
	return ACTIONS.find((known) => known === action) ?? null;
}

export function applyFormat(field: HTMLTextAreaElement, format: Format): void {
	if (field.readOnly) return;
	applyEdit(field, formatSelection(field.value, field.selectionStart, field.selectionEnd, format));
}

/** Makes `edit` in the field as one undo step, and saves it as typing would. */
function applyEdit(field: HTMLTextAreaElement, edit: FormatEdit): void {
	changeField(field, () => {
		field.setRangeText(edit.insert, edit.from, edit.to);
		field.setSelectionRange(edit.selectionStart, edit.selectionEnd);
	});
}

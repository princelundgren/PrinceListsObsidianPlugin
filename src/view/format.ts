import { setIcon } from 'obsidian';
import { formatSelection, type Format } from '../core/format';
import { changeField, stepField } from './field-undo';

export const FORMAT_BAR_CLASS = 'princelists-format-bar';
const ACTION_ATTR = 'data-format';

type BarAction = Format | 'undo' | 'redo';

const GROUPS: readonly (readonly { action: BarAction; icon: string; label: string }[])[] = [
	[
		{ action: 'undo', icon: 'undo-2', label: 'Undo' },
		{ action: 'redo', icon: 'redo-2', label: 'Redo' },
	],
	[
		{ action: 'bold', icon: 'bold', label: 'Bold' },
		{ action: 'italic', icon: 'italic', label: 'Italic' },
		{ action: 'strikethrough', icon: 'strikethrough', label: 'Strikethrough' },
		{ action: 'underline', icon: 'underline', label: 'Underline' },
	],
	[
		{ action: 'code', icon: 'code', label: 'Inline code' },
		{ action: 'link', icon: 'link', label: 'Link' },
	],
	[
		{ action: 'bulleted', icon: 'list', label: 'Bulleted list' },
		{ action: 'numbered', icon: 'list-ordered', label: 'Numbered list' },
		{ action: 'checklist', icon: 'list-checks', label: 'Checklist' },
	],
	[
		{ action: 'codeBlock', icon: 'square-code', label: 'Code block' },
		{ action: 'table', icon: 'table', label: 'Table' },
	],
];
const ACTIONS = GROUPS.flat().map((button) => button.action);

// Shown under a card's notes editor while it is open.
export function buildFormatBar(parent: HTMLElement): void {
	const bar = parent.createDiv({ cls: FORMAT_BAR_CLASS });
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

export function runBarAction(field: HTMLTextAreaElement, action: BarAction): void {
	if (action === 'undo' || action === 'redo') stepField(field, action);
	else applyFormat(field, action);
}

export function applyFormat(field: HTMLTextAreaElement, format: Format): void {
	if (field.readOnly) return;
	const edit = formatSelection(field.value, field.selectionStart, field.selectionEnd, format);
	changeField(field, () => {
		field.setRangeText(edit.insert, edit.from, edit.to);
		field.setSelectionRange(edit.selectionStart, edit.selectionEnd);
	});
	// setRangeText sends no input event, and the view saves a field's text from that event.
	field.dispatchEvent(new Event('input', { bubbles: true }));
}

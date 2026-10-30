import { FieldHistory, type FieldState } from '../core/field-history';

// A card field's own undo, kept from focus to blur: while the field has no focus an outside change
// can set its text, which an older step would then bring back.
const histories = new WeakMap<HTMLTextAreaElement, FieldHistory>();

export function startFieldHistory(field: HTMLTextAreaElement): void {
	histories.set(field, new FieldHistory());
}

export function endFieldHistory(field: HTMLTextAreaElement): void {
	histories.delete(field);
}

export function beforeFieldInput(field: HTMLTextAreaElement, kind: string): void {
	histories.get(field)?.willChange(stateOf(field), kind);
}

export function afterFieldInput(field: HTMLTextAreaElement): void {
	histories.get(field)?.didChange(stateOf(field));
}

// A change the view makes, which sends no beforeinput, as one undo step.
export function changeField(field: HTMLTextAreaElement, change: () => void): void {
	const before = stateOf(field);
	change();
	histories.get(field)?.changed(before, stateOf(field), 'script');
}

// Undoes or redoes a step in a field that keeps its own history, sending the input event the view
// saves from. False when the field keeps none, so the key stays the browser's.
export function stepField(field: HTMLTextAreaElement, direction: 'undo' | 'redo'): boolean {
	const history = histories.get(field);
	if (!history) return false;
	if (field.readOnly) return true;
	const current = stateOf(field);
	const state = direction === 'undo' ? history.undo(current) : history.redo(current);
	if (!state) return true;
	field.value = state.value;
	field.setSelectionRange(state.start, state.end);
	field.dispatchEvent(new Event('input', { bubbles: true }));
	return true;
}

function stateOf(field: HTMLTextAreaElement): FieldState {
	return { value: field.value, start: field.selectionStart, end: field.selectionEnd };
}

import { ButtonComponent, DropdownComponent, getLanguage, TextComponent } from 'obsidian';
import type { RepeatEnd, RepeatRule, RepeatUnit } from '../core/repeat';
import { stepDay, upcomingDays } from '../core/repeat';
import { anchorOf, canWrite, repeatOf, type RepeatDraft } from '../core/repeat-line';
import { dayLabel, dayOf } from '../core/when';
import { addHiddenLabel, labelBy, newLabelId } from './dom';

const ROW_CLASS = 'princelists-repeat-row';
const LABEL_CLASS = 'princelists-repeat-label';
const FIELDS_CLASS = 'princelists-repeat-fields';
/** On the form's Save button. */
export const SAVE_CLASS = 'princelists-repeat-save';
/** On the form's Remove repeat button. */
export const REMOVE_CLASS = 'princelists-repeat-remove';
const NEXT_COUNT = 3;
const DEFAULT_TIMES = 5;
// What an end date starts from: a year on.
const EVERY_YEAR: RepeatRule = { every: 1, unit: 'year', onLast: false, whenDone: false };

const UNITS: RepeatUnit[] = ['day', 'week', 'month', 'year'];

// The form's controls, by what the draft reads from them.
interface Controls {
	every: TextComponent;
	unit: DropdownComponent;
	from: DropdownComponent;
	onRow: HTMLElement;
	on: DropdownComponent;
	ends: DropdownComponent;
	endDate: TextComponent;
	endCount: TextComponent;
	timesLabel: HTMLElement;
	next: HTMLElement;
	nextDays: HTMLElement;
	save: ButtonComponent;
	/** Whether the unit options read as plurals now. */
	plural: boolean;
}

const controlsOf = new WeakMap<HTMLElement, Controls>();

/**
 * Fills `el` with the repeat form for the line `text`, showing `draft`: its controls, or a rule it
 * can't write read-only, then the next dates, Save, and Remove repeat where the line repeats.
 */
export function buildRepeatForm(el: HTMLElement, text: string, draft: RepeatDraft | 'read-only'): void {
	const body = el.createDiv({ cls: 'princelists-repeat-body' });
	const footer = el.createDiv({ cls: 'princelists-repeat-footer' });
	const actions = draft === 'read-only' ? buildReadOnly(body, footer, text) : buildControls(el, body, footer, draft, anchorOf(text));
	if (repeatOf(text) !== null) {
		const remove = new ButtonComponent(actions).setButtonText('Remove repeat').buttonEl;
		remove.addClass(REMOVE_CLASS);
		actions.prepend(remove);
	}
}

/**
 * Reads the draft again after typing or a change in one of the form's controls in `el`, and redraws
 * what depends on it, with `anchor` the line's date the next dates count from. Returns the draft, or
 * null when `evt` isn't on one of its controls.
 */
export function readRepeatForm(el: HTMLElement, evt: Event, anchor: string | null): RepeatDraft | null {
	const controls = controlsOf.get(el);
	// The event is a plain Event, without Obsidian's targetNode, so the control is found among the form's own.
	const isOwn = Array.from(el.querySelectorAll('input, select')).some((control) => control === evt.target);
	if (!controls || !isOwn) return null;
	if (evt.target === controls.ends.selectEl) prefillEnd(controls);
	const draft = readDraft(controls);
	showDraft(controls, draft, anchor);
	return draft;
}

// Each builder fills the form and the footer, and returns the footer's row for the buttons.
function buildReadOnly(body: HTMLElement, footer: HTMLElement, text: string): HTMLElement {
	body.createDiv({ cls: 'princelists-repeat-read-only', text: `Repeats: ${repeatOf(text)?.ruleText ?? ''}` });
	return footer.createDiv({ cls: 'princelists-repeat-actions' });
}

// A row of the form, its label in the first column and its fields in the second. The row is a
// `label`, so a click on the label's text focuses the first field.
function addRow(body: HTMLElement, text: string): { row: HTMLElement; label: HTMLElement; fields: HTMLElement } {
	const row = body.createEl('label', { cls: ROW_CLASS });
	const label = row.createSpan({ cls: LABEL_CLASS, text });
	return { row, label, fields: row.createDiv({ cls: FIELDS_CLASS }) };
}

function buildControls(el: HTMLElement, body: HTMLElement, footer: HTMLElement, draft: RepeatDraft, anchor: string | null): HTMLElement {
	const everyRow = addRow(body, 'Every');
	const everyFields = everyRow.fields;
	const every = new TextComponent(everyFields).setValue(String(draft.rule.every));
	// Named by its label alone: the row's text would add the unit's hidden name.
	labelBy(every.inputEl, everyRow.label);
	Object.assign(every.inputEl, { type: 'number', min: '1', max: '9999', step: '1' });
	every.inputEl.addClass('princelists-repeat-count');
	const unit = new DropdownComponent(everyFields);
	addHiddenLabel(unit.selectEl, 'Unit');

	const from = new DropdownComponent(addRow(body, 'Counted from').fields).addOptions({ date: 'Its date', done: "When it's ticked" });

	const onRow = addRow(body, 'On');
	const on = new DropdownComponent(onRow.fields).addOptions({ same: 'The same day', last: 'The last day' });

	// Only its label cell is a `label`, for the select: the other fields have names of their own.
	const endsRow = body.createDiv({ cls: ROW_CLASS });
	const endsLabel = endsRow.createEl('label', { cls: LABEL_CLASS, text: 'Ends' });
	const endsFields = endsRow.createDiv({ cls: FIELDS_CLASS });
	const ends = new DropdownComponent(endsFields).addOptions({ never: 'Never', date: 'On a date', times: 'After' });
	ends.selectEl.id = newLabelId();
	endsLabel.htmlFor = ends.selectEl.id;
	const endDate = new TextComponent(endsFields);
	endDate.inputEl.type = 'date';
	addHiddenLabel(endDate.inputEl, 'End date');
	const endCount = new TextComponent(endsFields);
	Object.assign(endCount.inputEl, { type: 'number', min: '1', step: '1' });
	endCount.inputEl.addClass('princelists-repeat-count');
	addHiddenLabel(endCount.inputEl, 'Number of times');
	const timesLabel = endsFields.createSpan({ cls: 'princelists-repeat-times', text: 'times' });

	const next = footer.createDiv({ cls: 'princelists-repeat-next' });
	next.createSpan({ cls: 'princelists-repeat-next-label', text: 'Next' });
	const nextDays = next.createSpan();
	const actions = footer.createDiv({ cls: 'princelists-repeat-actions' });
	const save = new ButtonComponent(actions).setButtonText('Save').setCta();
	save.buttonEl.addClass(SAVE_CLASS);

	const controls: Controls = { every, unit, from, onRow: onRow.row, on, ends, endDate, endCount, timesLabel, next, nextDays, save, plural: false };
	controlsOf.set(el, controls);
	from.setValue(draft.rule.whenDone ? 'done' : 'date');
	on.setValue(draft.rule.onLast ? 'last' : 'same');
	ends.setValue(draft.end?.kind ?? 'never');
	endDate.setValue(draft.end?.kind === 'date' ? draft.end.day : '');
	endCount.setValue(String(draft.end?.kind === 'times' ? draft.end.left : DEFAULT_TIMES));
	fillUnits(controls, draft.rule.every === 1, draft.rule.unit);
	showDraft(controls, draft, anchor);
	return actions;
}

// The unit options read in the plural unless the count is 1.
function fillUnits(controls: Controls, isOne: boolean, unit: RepeatUnit): void {
	controls.plural = !isOne;
	controls.unit.selectEl.empty();
	for (const each of UNITS) controls.unit.addOption(each, isOne ? each : `${each}s`);
	controls.unit.setValue(unit);
}

// A new kind of end starts from a value that is already good to save.
function prefillEnd(controls: Controls): void {
	const kind = controls.ends.getValue();
	if (kind === 'date' && controls.endDate.getValue() === '') controls.endDate.setValue(stepDay(dayOf(new Date()), EVERY_YEAR) ?? '');
	if (kind === 'times' && controls.endCount.getValue() === '') controls.endCount.setValue(String(DEFAULT_TIMES));
}

function readDraft(controls: Controls): RepeatDraft {
	const unit = controls.unit.getValue() as RepeatUnit;
	const kind = controls.ends.getValue();
	let end: RepeatEnd | null = null;
	if (kind === 'date') end = { kind: 'date', day: controls.endDate.getValue() };
	else if (kind === 'times') end = { kind: 'times', left: Number(controls.endCount.getValue()) };
	return {
		rule: {
			every: Number(controls.every.getValue()),
			unit,
			onLast: unit === 'month' && controls.on.getValue() === 'last',
			whenDone: controls.from.getValue() === 'done',
		},
		end,
	};
}

// What depends on the draft: the unit names, which controls show, the next dates and Save.
function showDraft(controls: Controls, draft: RepeatDraft, anchor: string | null): void {
	const isOne = draft.rule.every === 1;
	if (controls.plural === isOne) fillUnits(controls, isOne, draft.rule.unit);
	controls.onRow.toggle(draft.rule.unit === 'month');
	controls.endDate.inputEl.toggle(draft.end?.kind === 'date');
	controls.endCount.inputEl.toggle(draft.end?.kind === 'times');
	controls.timesLabel.toggle(draft.end?.kind === 'times');
	const valid = canWrite(draft);
	controls.save.setDisabled(!valid);
	const today = dayOf(new Date());
	const days = valid ? upcomingDays(anchor, draft.rule, draft.end, today, NEXT_COUNT) : [];
	controls.next.toggle(days.length > 0);
	controls.nextDays.empty();
	days.forEach((day, at) => {
		if (at > 0) controls.nextDays.appendText(' · ');
		controls.nextDays.createSpan({ cls: 'princelists-repeat-day', text: dayLabel(day, today, getLanguage()) });
	});
}

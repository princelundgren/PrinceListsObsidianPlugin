import { ButtonComponent, DropdownComponent, getLanguage, setIcon, TextComponent } from 'obsidian';
import type { RepeatEnd, RepeatRule, RepeatUnit } from '../core/repeat';
import { stepDay, upcomingDays } from '../core/repeat';
import { anchorOf, canWrite, draftAfterRefusal, draftOf, ensureTickable, removeRepeat, repeatOf, setRepeat, type RepeatDraft } from '../core/repeat-line';
import { dayLabel, dayOf } from '../core/when';
import { CARD_TOOLS_CLASS, placeCardPopover } from './card-tools';
import { addHiddenLabel, labelBy, newLabelId } from './dom';
import { queueDraftEdit } from './line-edit';
import type { PrinceListView } from './list-view';

const REPEAT_BUTTON_CLASS = 'princelists-card-repeat';
const POPOVER_CLASS = 'princelists-repeat-popover';
const ROW_CLASS = 'princelists-repeat-row';
const LABEL_CLASS = 'princelists-repeat-label';
const FIELDS_CLASS = 'princelists-repeat-fields';
const SAVE_CLASS = 'princelists-repeat-save';
const REMOVE_CLASS = 'princelists-repeat-remove';
const NEXT_COUNT = 3;
const DEFAULT_TIMES = 5;
// What an end date starts from: a year on.
const EVERY_YEAR: RepeatRule = { every: 1, unit: 'year', onLast: false, whenDone: false };

const UNITS: RepeatUnit[] = ['day', 'week', 'month', 'year'];

// The popover's controls, by what the draft reads from them.
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

/** Adds the card's `Repeat` button to `buttons`; call it after the star and before the date picker. */
export function buildRepeatButton(buttons: HTMLElement): void {
	const button = buttons.createEl('button', { cls: REPEAT_BUTTON_CLASS, attr: { 'aria-label': 'Repeat', 'aria-expanded': 'false' } });
	setIcon(button, 'repeat');
}

/** Marks the card's `Repeat` button, and names it `Edit repeat`, while its item repeats. */
export function showRepeatButton(cardEl: HTMLElement, repeats: boolean): void {
	const button = cardEl.querySelector<HTMLElement>(`.${REPEAT_BUTTON_CLASS}`);
	button?.toggleClass('is-repeating', repeats);
	button?.setAttribute('aria-label', repeats ? 'Edit repeat' : 'Repeat');
}

/** Opens the repeat popover from the open card's buttons, with the draft its item's line gives; closes it if it's open. */
function toggleRepeatPopover(view: PrinceListView): void {
	if (view.repeatPopover) {
		escapeRepeatPopover(view);
		return;
	}
	openRepeatPopover(view);
}

/**
 * Opens the repeat popover, and leaves it as it is when it's open, which a menu entry has no
 * reason to close. `kept` is the draft to show instead of the line's own.
 */
export function openRepeatPopover(view: PrinceListView, kept?: RepeatDraft | 'read-only'): void {
	if (view.repeatPopover) return;
	const line = view.selected;
	const tools = view.card?.el.querySelector<HTMLElement>(`.${CARD_TOOLS_CLASS}`);
	const text = line === null ? undefined : view.lines()[line]?.text;
	if (!tools || text === undefined) return;
	const draft = kept ?? draftOf(text);
	// Focusable itself, so a press on its labels or gaps keeps focus inside it.
	const el = tools.createDiv({ cls: POPOVER_CLASS, attr: { role: 'dialog', tabindex: -1 } });
	view.repeatPopover = { el, opened: { text, seen: view.outsideChanges }, draft };
	labelBy(el, el.createDiv({ cls: 'princelists-repeat-title', text: 'Repeat' }));
	const body = el.createDiv({ cls: 'princelists-repeat-body' });
	const footer = el.createDiv({ cls: 'princelists-repeat-footer' });
	const actions = draft === 'read-only' ? buildReadOnly(body, footer, text) : buildControls(el, body, footer, draft, anchorOf(text));
	if (repeatOf(text) !== null) {
		const remove = new ButtonComponent(actions).setButtonText('Remove repeat').buttonEl;
		remove.addClass(REMOVE_CLASS);
		actions.prepend(remove);
	}
	repeatButtonOf(view)?.setAttr('aria-expanded', 'true');
	(el.querySelector<HTMLElement>('input, button') ?? el).focus();
	placeCardPopover(view, el);
}

/** Closes the repeat popover. */
export function closeRepeatPopover(view: PrinceListView): void {
	const open = view.repeatPopover;
	if (!open) return;
	view.repeatPopover = null;
	open.el.remove();
	repeatButtonOf(view)?.setAttr('aria-expanded', 'false');
}

/** Closes the repeat popover and focuses the card's repeat button. */
export function escapeRepeatPopover(view: PrinceListView): void {
	closeRepeatPopover(view);
	repeatButtonOf(view)?.focus();
}

/** Whether `target` is in the open repeat popover. */
export function isInRepeatPopover(view: PrinceListView, target: Node | null): boolean {
	return view.repeatPopover?.el.contains(target) ?? false;
}

/**
 * Handles a click on the repeat button, Save or Remove repeat. Returns whether `target` was on one.
 */
export function repeatClick(view: PrinceListView, target: HTMLElement): boolean {
	if (target.closest(`.${REPEAT_BUTTON_CLASS}`)) {
		toggleRepeatPopover(view);
		return true;
	}
	if (!isInRepeatPopover(view, target)) return false;
	if (target.closest(`.${SAVE_CLASS}`)) saveRepeat(view);
	else if (target.closest(`.${REMOVE_CLASS}`)) removeRepeatFromLine(view);
	return true;
}

/** Reads the draft again after typing or a change in one of the popover's controls, and redraws what depends on it. */
export function repeatInput(view: PrinceListView, evt: Event): void {
	const open = view.repeatPopover;
	const controls = open ? controlsOf.get(open.el) : undefined;
	// The event is a plain Event, without Obsidian's targetNode, so the control is found among the popover's own.
	const isOwn = open && Array.from(open.el.querySelectorAll('input, select')).some((control) => control === evt.target);
	if (!open || !controls || open.draft === 'read-only' || !isOwn) return;
	if (evt.target === controls.ends.selectEl) prefillEnd(controls);
	open.draft = readDraft(controls);
	showDraft(controls, open.draft, anchorOf(open.opened.text));
}

/** Saves the draft, as the Save button does. */
export function saveRepeat(view: PrinceListView): void {
	const open = view.repeatPopover;
	if (!open || open.draft === 'read-only' || !canWrite(open.draft)) return;
	const { rule, end } = open.draft;
	// Today at the save, not at the popover's drawing.
	writeToLine(view, (text) => ensureTickable(setRepeat(text, rule, end, dayOf(new Date()))));
}

function removeRepeatFromLine(view: PrinceListView): void {
	writeToLine(view, removeRepeat);
}

// One write from the draft's base. The popover closes first; if the write is refused, it opens again
// with the draft while the line still reads as it did, else on the line as it reads now.
function writeToLine(view: PrinceListView, change: (line: string) => string): void {
	const open = view.repeatPopover;
	const line = view.selected;
	// An outside change takes the card's item and closes the popover with it (`cardLost`).
	if (!open || line === null) return;
	closeRepeatPopover(view);
	queueDraftEdit(view, line, open.opened, change, {
		// The write is async: focus comes back to the card only if the user hasn't gone elsewhere.
		written: () => {
			const { body, activeElement } = view.contentEl.doc;
			if (activeElement === body || activeElement === null) repeatButtonOf(view)?.focus();
		},
		refused: (tracked) => {
			const now = view.lines()[tracked]?.text;
			if (view.selected !== tracked || now === undefined) return;
			openRepeatPopover(view, draftAfterRefusal(open.draft, open.opened.text, now));
		},
	});
}

function repeatButtonOf(view: PrinceListView): HTMLElement | null {
	return view.card?.el.querySelector<HTMLElement>(`.${REPEAT_BUTTON_CLASS}`) ?? null;
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

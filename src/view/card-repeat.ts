import { ButtonComponent, DropdownComponent, getLanguage, Notice, setIcon, TextComponent } from 'obsidian';
import type { RepeatEnd, RepeatUnit } from '../core/repeat';
import { stepDay, upcomingDays } from '../core/repeat';
import { anchorOf, canWrite, draftOf, ensureTickable, removeRepeat, repeatOf, setRepeat, type RepeatDraft } from '../core/repeat-line';
import { dayLabel, dayOf } from '../core/when';
import { WHEN_INPUT_CLASS } from './card-when';
import { addHiddenLabel } from './dom';
import { queueDraftEdit } from './line-edit';
import type { PrinceListView } from './list-view';
import { CHANGED_ELSEWHERE_NOTICE } from './write';

const REPEAT_BUTTON_CLASS = 'princelists-card-repeat';
const POPOVER_CLASS = 'princelists-repeat-popover';
const ROW_CLASS = 'princelists-repeat-row';
const SAVE_CLASS = 'princelists-repeat-save';
const REMOVE_CLASS = 'princelists-repeat-remove';
const NEXT_COUNT = 3;
const DEFAULT_TIMES = 5;

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
	save: ButtonComponent;
	/** Whether the unit options read as plurals now. */
	plural: boolean;
}

const controlsOf = new WeakMap<HTMLElement, Controls>();

/** Adds the card's `Repeat` button last in `tools`, so call it right after the date picker; hidden until the item repeats. */
export function buildRepeatButton(tools: HTMLElement): void {
	const button = tools.createEl('button', { cls: REPEAT_BUTTON_CLASS, attr: { 'aria-label': 'Repeat', 'aria-expanded': 'false' } });
	setIcon(button, 'repeat');
	button.hide();
}

/** Shows the card's `Repeat` button while its item repeats. */
export function showRepeatButton(cardEl: HTMLElement, repeats: boolean): void {
	cardEl.querySelector<HTMLElement>(`.${REPEAT_BUTTON_CLASS}`)?.toggle(repeats);
}

/** Opens the repeat popover under the open card's tools, with the draft its item's line gives; closes it if it's open. */
export function toggleRepeatPopover(view: PrinceListView): void {
	if (view.repeatPopover) {
		escapeRepeatPopover(view);
		return;
	}
	const line = view.selected;
	const tools = view.card?.el.querySelector<HTMLElement>('.princelists-card-tools');
	const text = line === null ? undefined : view.lines()[line]?.text;
	if (!tools || text === undefined) return;
	const draft = draftOf(text);
	// Focusable itself, so a press on its labels or gaps keeps focus inside it.
	const el = tools.createDiv({ cls: POPOVER_CLASS, attr: { role: 'dialog', tabindex: -1 } });
	view.repeatPopover = { el, opened: { text, seen: view.outsideChanges }, draft };
	const body = el.createDiv({ cls: 'princelists-repeat-body' });
	addHiddenLabel(body, 'Repeat');
	el.setAttr('aria-labelledby', body.getAttr('aria-labelledby') ?? '');
	const actions = draft === 'read-only' ? buildReadOnly(body, text) : buildControls(el, body, draft, anchorOf(text));
	if (repeatOf(text) !== null) new ButtonComponent(actions).setButtonText('Remove repeat').buttonEl.addClass(REMOVE_CLASS);
	repeatButtonOf(view)?.setAttr('aria-expanded', 'true');
	(el.querySelector<HTMLElement>('input, button') ?? el).focus();
	el.scrollIntoView({ block: 'nearest' });
}

/** Closes the repeat popover. */
export function closeRepeatPopover(view: PrinceListView): void {
	const open = view.repeatPopover;
	if (!open) return;
	view.repeatPopover = null;
	open.el.remove();
	repeatButtonOf(view)?.setAttr('aria-expanded', 'false');
}

/** Closes the repeat popover and focuses the card's repeat button, or its date when the item doesn't repeat yet. */
export function escapeRepeatPopover(view: PrinceListView): void {
	closeRepeatPopover(view);
	focusRepeatEntry(view);
}

/** Whether `target` is in the open repeat popover. */
export function isInRepeatPopover(view: PrinceListView, target: Node | null): boolean {
	return view.repeatPopover?.el.contains(target) ?? false;
}

/** Whether `target` is the open card's repeat button while its popover is open. */
export function isOpenRepeatButton(view: PrinceListView, target: HTMLElement): boolean {
	return view.repeatPopover !== null && target.closest(`.${REPEAT_BUTTON_CLASS}`) !== null;
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
	open.draft = readDraft(controls, open.draft);
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

// One write from the draft's base. The popover closes first; if the line moved on, it opens again on it.
function writeToLine(view: PrinceListView, change: (line: string) => string): void {
	const open = view.repeatPopover;
	const line = view.selected;
	if (!open) return;
	// An outside change took the item's own line, and with it the card's item: nothing to write to.
	if (line === null || view.card?.lostAt != null) {
		closeRepeatPopover(view);
		new Notice(CHANGED_ELSEWHERE_NOTICE);
		return;
	}
	closeRepeatPopover(view);
	focusRepeatEntry(view);
	queueDraftEdit(view, line, open.opened, change, {
		written: () => focusRepeatEntry(view),
		refused: (tracked) => {
			if (view.selected === tracked) toggleRepeatPopover(view);
		},
	});
}

function focusRepeatEntry(view: PrinceListView): void {
	const button = repeatButtonOf(view);
	if (button && button.isShown()) button.focus();
	else view.card?.el.querySelector<HTMLElement>(`.${WHEN_INPUT_CLASS}`)?.focus();
}

function repeatButtonOf(view: PrinceListView): HTMLElement | null {
	return view.card?.el.querySelector<HTMLElement>(`.${REPEAT_BUTTON_CLASS}`) ?? null;
}

// Each builder returns the row for the buttons.
function buildReadOnly(body: HTMLElement, text: string): HTMLElement {
	body.createDiv({ cls: ROW_CLASS, text: `Repeats: ${repeatOf(text)?.ruleText ?? ''}` });
	return body.createDiv({ cls: 'princelists-repeat-actions' });
}

function buildControls(el: HTMLElement, body: HTMLElement, draft: RepeatDraft, anchor: string | null): HTMLElement {
	const everyRow = body.createEl('label', { cls: ROW_CLASS });
	everyRow.createSpan({ text: 'Every' });
	const every = new TextComponent(everyRow).setValue(String(draft.rule.every));
	Object.assign(every.inputEl, { type: 'number', min: '1', max: '9999', step: '1' });
	every.inputEl.addClass('princelists-repeat-count');
	const unit = new DropdownComponent(everyRow);
	addHiddenLabel(unit.selectEl, 'Unit');

	const fromRow = body.createEl('label', { cls: ROW_CLASS });
	fromRow.createSpan({ text: 'Counted from' });
	const from = new DropdownComponent(fromRow).addOptions({ date: 'Its date', done: "When it's ticked" });

	const onRow = body.createEl('label', { cls: ROW_CLASS });
	onRow.createSpan({ text: 'On' });
	const on = new DropdownComponent(onRow).addOptions({ same: 'The same day', last: 'The last day' });

	const endsRow = body.createDiv({ cls: ROW_CLASS });
	const endsLabel = endsRow.createEl('label', { cls: ROW_CLASS });
	endsLabel.createSpan({ text: 'Ends' });
	const ends = new DropdownComponent(endsLabel).addOptions({ never: 'Never', date: 'On a date', times: 'After' });
	const endDate = new TextComponent(endsRow);
	endDate.inputEl.type = 'date';
	addHiddenLabel(endDate.inputEl, 'End date');
	const endCount = new TextComponent(endsRow);
	Object.assign(endCount.inputEl, { type: 'number', min: '1', step: '1' });
	endCount.inputEl.addClass('princelists-repeat-count');
	addHiddenLabel(endCount.inputEl, 'Number of times');
	const timesLabel = endsRow.createSpan({ text: 'times' });

	const next = body.createDiv({ cls: ROW_CLASS });
	const actions = body.createDiv({ cls: 'princelists-repeat-actions' });
	const save = new ButtonComponent(actions).setButtonText('Save').setCta();
	save.buttonEl.addClass(SAVE_CLASS);

	const controls: Controls = { every, unit, from, onRow, on, ends, endDate, endCount, timesLabel, next, save, plural: false };
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

function readDraft(controls: Controls, before: RepeatDraft): RepeatDraft {
	const unit = controls.unit.getValue() as RepeatUnit;
	const kind = controls.ends.getValue();
	// A new kind of end starts from a value that is already good to save.
	if (kind !== (before.end?.kind ?? 'never')) {
		if (kind === 'date' && controls.endDate.getValue() === '') controls.endDate.setValue(stepDay(dayOf(new Date()), { every: 1, unit: 'year', onLast: false, whenDone: false }) ?? '');
		if (kind === 'times' && controls.endCount.getValue() === '') controls.endCount.setValue(String(DEFAULT_TIMES));
	}
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
	controls.next.setText(`Next: ${days.map((day) => dayLabel(day, today, getLanguage())).join(', ')}`);
}

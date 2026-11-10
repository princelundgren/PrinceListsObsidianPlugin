import type { Menu } from 'obsidian';
import { groupCount } from '../core/group-actions';
import { countPhrase, groupState, planGroupDelete, planGroupLineEdit, planGroupTick, type PlannedGroupChange } from '../core/group-edits';
import { changeMessage, groupEntries, type EntryGroup, type GroupChange, type GroupEntry } from '../core/group-menu';
import { setStar } from '../core/star';
import { dayAfter, dayOf, setWhen } from '../core/when';
import { contentStartLine } from '../obsidian/marker';
import { DateModal } from './date-modal';
import { queueGroupAction } from './group-write';
import { HeadingPickerModal } from './heading-picker';
import type { PrinceListView } from './list-view';
import { queueGroupMove } from './move';
import { clearSelection } from './select';

type GroupPlan = (text: string, contentStart: number, rows: readonly number[]) => PlannedGroupChange | null;

/**
 * Adds the selection's entries to `menu`, each shown only while it would change something (the
 * design's "The actions"), or only `only`'s group of them. Each entry acts on the rows selected when
 * it is chosen.
 */
export function addGroupEntries(view: PrinceListView, menu: Menu, only?: EntryGroup): void {
	const text = view.text;
	const contentStart = contentStartLine(text);
	const state = groupState(text, contentStart, view.selection.lines());
	const listHasHeadings = view.parse().model.sections.some((section) => section.headingLine !== null);
	let previous: string | null = null;
	for (const entry of groupEntries(state, listHasHeadings, only)) {
		const part = PARTS[entry];
		if (previous !== null && part !== previous) menu.addSeparator();
		previous = part;
		if (entry === 'delete') {
			menu.addItem((item) =>
				item
					.setTitle(`Delete ${countPhrase(state.items, state.headings)}`)
					.setIcon('trash-2')
					.setWarning(true)
					.onClick(() => deleteSelection(view)),
			);
		} else {
			const { title, icon } = ENTRY_LOOKS[entry];
			menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(() => act(view, entry)));
		}
	}
}

/** Opens the heading picker, then moves the selected rows to the end of the section picked. */
export function moveToHeading(view: PrinceListView): void {
	new HeadingPickerModal(view, (headingLine) => {
		const rows = view.selection.lines();
		if (rows.length === 0) return;
		const { items, headings } = groupCount(view.text, contentStartLine(view.text), rows);
		queueGroupMove(view, rows, { endOf: headingLine }, `${countPhrase(items, headings)} moved.`);
	}).open();
}

/** Deletes the selected items and headings in one write, with an Undo message, and ends the selection. */
export function deleteSelection(view: PrinceListView): void {
	const rows = view.selection.lines();
	if (rows.length === 0) return;
	const { items, headings } = groupState(view.text, contentStartLine(view.text), rows);
	const message = `${countPhrase(items, headings)} deleted.`;
	queueGroupAction(view, rows, planGroupDelete, () => message);
	clearSelection(view);
}

// Where the menu puts a separator: between these parts.
const PARTS: Record<GroupEntry, string> = {
	move: 'move',
	tick: 'mark',
	untick: 'mark',
	addStar: 'mark',
	removeStar: 'mark',
	today: 'date',
	tomorrow: 'date',
	pickDate: 'date',
	removeDate: 'date',
	delete: 'delete',
};

const ENTRY_LOOKS: Record<Exclude<GroupEntry, 'delete'>, { title: string; icon: string }> = {
	move: { title: 'Move to heading…', icon: 'list-end' },
	tick: { title: 'Tick', icon: 'check' },
	untick: { title: 'Untick', icon: 'square' },
	addStar: { title: 'Add star', icon: 'star' },
	removeStar: { title: 'Remove star', icon: 'star-off' },
	today: { title: 'Set date to today', icon: 'calendar-check' },
	tomorrow: { title: 'Set date to tomorrow', icon: 'calendar-plus' },
	pickDate: { title: 'Set date…', icon: 'calendar' },
	removeDate: { title: 'Remove date', icon: 'calendar-x' },
};

function act(view: PrinceListView, entry: Exclude<GroupEntry, 'delete'>): void {
	switch (entry) {
		case 'move':
			return moveToHeading(view);
		case 'tick':
			return changeSelection(view, 'tick', (text, start, rows) => planGroupTick(text, start, rows, true, new Date()));
		case 'untick':
			return changeSelection(view, 'untick', (text, start, rows) => planGroupTick(text, start, rows, false, new Date()));
		case 'addStar':
			return changeSelection(view, 'addStar', lineEdit((line) => setStar(line, true)));
		case 'removeStar':
			return changeSelection(view, 'removeStar', lineEdit((line) => setStar(line, false)));
		case 'today':
			return changeSelection(view, 'setDate', lineEdit((line) => setWhen(line, dayOf(new Date()))));
		case 'tomorrow':
			return changeSelection(view, 'setDate', lineEdit((line) => setWhen(line, dayAfter(new Date()))));
		case 'pickDate':
			return new DateModal(view.app, (day) => changeSelection(view, 'setDate', lineEdit((line) => setWhen(line, day)))).open();
		case 'removeDate':
			return changeSelection(view, 'removeDate', lineEdit((line) => setWhen(line, null)));
	}
}

function lineEdit(change: (line: string) => string): GroupPlan {
	return (text, start, rows) => planGroupLineEdit(text, start, rows, change);
}

// A tick that every selected item repeats writes nothing, and the write's tryEdit says why.
function changeSelection(view: PrinceListView, change: GroupChange, plan: GroupPlan): void {
	const rows = view.selection.lines();
	if (rows.length > 0) queueGroupAction(view, rows, plan, (written) => changeMessage(change, written));
}

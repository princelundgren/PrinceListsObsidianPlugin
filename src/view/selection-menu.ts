import type { Menu } from 'obsidian';
import { groupCount } from '../core/group-actions';
import { planGroupDuplicate } from '../core/duplicate';
import { countPhrase, groupState, planGroupDelete, planGroupLineEdit, planGroupTick, type PlannedGroupChange } from '../core/group-edits';
import { changeMessage, groupEntries, placesBelow, type EntryGroup, type GroupChange, type GroupEntry, type PlacesBelow } from '../core/group-menu';
import { removeWhen } from '../core/repeat-line';
import { setStar } from '../core/star';
import { dayAfter, dayOf, setWhen } from '../core/when';
import { contentStartLine } from '../obsidian/marker';
import { addItem } from './add-button';
import { DateModal } from './date-modal';
import { queueGroupAction } from './group-write';
import { addHeading } from './heading-field';
import { HeadingPickerModal } from './heading-picker';
import type { PrinceListView } from './list-view';
import { onMenuHide } from './menu-anchor';
import { queueGroupMove, shownRows } from './move';
import { clearSelection } from './select';
import { openSelectionTags } from './selection-bar';

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
	let previous: string | null = null;
	for (const entry of groupEntries(state, listHasHeadings(view), only)) {
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
			menu.addItem((item) =>
				item.setTitle(title).setIcon(icon).onClick(() => {
					// After the menu hides, so the focus it gives back doesn't leave the popover's field.
					if (entry === 'tag') onMenuHide(menu, () => openSelectionTags(view));
					else act(view, entry);
				}),
			);
		}
	}
}

/** Whether the view's list has a heading, which Move to heading… needs. */
export function listHasHeadings(view: PrinceListView): boolean {
	return view.parse().model.sections.some((section) => section.headingLine !== null);
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

/** Copies the items on `rows`, each right below its own, in one write, with an Undo message. */
export function duplicateItems(view: PrinceListView, rows: readonly number[]): void {
	if (rows.length > 0) queueGroupAction(view, rows, planGroupDuplicate, (written) => `${countPhrase(written.copied, 0)} duplicated.`);
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
	tag: 'mark',
	addStar: 'mark',
	removeStar: 'mark',
	today: 'date',
	tomorrow: 'date',
	pickDate: 'date',
	removeDate: 'date',
	newItem: 'new',
	newHeading: 'new',
	duplicate: 'new',
	delete: 'delete',
};

const ENTRY_LOOKS: Record<Exclude<GroupEntry, 'delete'>, { title: string; icon: string }> = {
	move: { title: 'Move to heading…', icon: 'list-end' },
	tick: { title: 'Tick', icon: 'check' },
	untick: { title: 'Untick', icon: 'square' },
	tag: { title: 'Tag…', icon: 'tag' },
	addStar: { title: 'Add star', icon: 'star' },
	removeStar: { title: 'Remove star', icon: 'star-off' },
	today: { title: 'Set date to today', icon: 'calendar-check' },
	tomorrow: { title: 'Set date to tomorrow', icon: 'calendar-plus' },
	pickDate: { title: 'Set date…', icon: 'calendar' },
	removeDate: { title: 'Remove date', icon: 'calendar-x' },
	newItem: { title: 'New item below', icon: 'list-plus' },
	newHeading: { title: 'New heading below', icon: 'heading' },
	duplicate: { title: 'Duplicate', icon: 'copy' },
};

function act(view: PrinceListView, entry: Exclude<GroupEntry, 'delete' | 'tag'>): void {
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
			return changeSelection(view, 'removeDate', lineEdit((line) => removeWhen(line).line));
		case 'newItem':
			return addBelowSelection(view, (places) => addItem(view, places.item));
		case 'newHeading':
			return addBelowSelection(view, (places) => addHeading(view, places.heading));
		case 'duplicate':
			return duplicateItems(view, view.selection.lines());
	}
}

// Ends the selection, then adds under its last row in list order (core's placesBelow).
function addBelowSelection(view: PrinceListView, add: (places: PlacesBelow) => void): void {
	const places = placesBelow(shownRows(view.listScrollEl), view.selection.lines());
	clearSelection(view);
	if (places) add(places);
}

function lineEdit(change: (line: string) => string): GroupPlan {
	return (text, start, rows) => planGroupLineEdit(text, start, rows, change);
}

function changeSelection(view: PrinceListView, change: GroupChange, plan: GroupPlan): void {
	const rows = view.selection.lines();
	if (rows.length > 0) queueGroupAction(view, rows, plan, (written) => changeMessage(change, written));
}

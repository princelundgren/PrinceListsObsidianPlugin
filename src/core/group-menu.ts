import { countPhrase, type GroupState, type PlannedGroupChange } from './group-edits';
import type { HeadingPlace, ItemPlace } from './list-actions';

/** An entry of the selection's menu. */
export type GroupEntry = 'move' | 'tick' | 'untick' | 'tag' | 'addStar' | 'removeStar' | 'today' | 'tomorrow' | 'pickDate' | 'removeDate' | 'newItem' | 'newHeading' | 'duplicate' | 'delete';

/** The entries the bar's Date and More buttons each show in a menu. */
export type EntryGroup = 'date' | 'more';

/** What a tick, star or date entry changed, for its Undo message. */
export type GroupChange = 'tick' | 'untick' | 'addStar' | 'removeStar' | 'setDate' | 'removeDate';

const ENTRY_GROUPS: Record<EntryGroup, readonly GroupEntry[]> = {
	date: ['today', 'tomorrow', 'pickDate', 'removeDate'],
	more: ['tick', 'untick', 'tag', 'addStar', 'removeStar', 'newItem', 'newHeading', 'duplicate'],
};

/**
 * The entries for a selection that holds `state`, in the menu's order, or only `only`'s group of them.
 * An entry with nothing to change hides. Move shows only while no heading is selected, in a list with
 * headings, and Duplicate only while no heading is selected.
 */
export function groupEntries(state: GroupState, listHasHeadings: boolean, only?: EntryGroup): GroupEntry[] {
	const shows: Record<GroupEntry, boolean> = {
		move: listHasHeadings && state.headings === 0 && state.items > 0,
		tick: state.anyUnticked,
		untick: state.anyTicked,
		tag: state.items + state.headings > 0,
		addStar: state.anyUnstarred,
		removeStar: state.anyStarred,
		today: state.items > 0,
		tomorrow: state.items > 0,
		pickDate: state.items > 0,
		removeDate: state.anyDated,
		newItem: state.items + state.headings > 0,
		newHeading: state.items + state.headings > 0,
		duplicate: state.items > 0 && state.headings === 0,
		delete: state.items + state.headings > 0,
	};
	const order = only ? ENTRY_GROUPS[only] : (Object.keys(shows) as GroupEntry[]);
	return order.filter((entry) => shows[entry]);
}

/** A button of the bar that acts on the selection. */
export type BarButton = 'move' | EntryGroup | 'delete';

/**
 * Whether each of the bar's buttons has something to act on for a selection that holds `state`: Move
 * to while Move to heading… shows, Date and More while any entry of their menu does, and Delete while
 * anything is selected.
 */
export function barButtons(state: GroupState, listHasHeadings: boolean): Record<BarButton, boolean> {
	const entries = groupEntries(state, listHasHeadings);
	const showsAny = (group: EntryGroup): boolean => ENTRY_GROUPS[group].some((entry) => entries.includes(entry));
	return {
		move: entries.includes('move'),
		date: showsAny('date'),
		more: showsAny('more'),
		delete: entries.includes('delete'),
	};
}

/**
 * Where New item below and New heading below add, under the selection's last row: an item right
 * after a selected item and a heading after it, or an item first under a selected heading and a
 * heading after its section.
 */
export function placesBelow(row: { kind: 'item' | 'heading'; line: number }): { item: ItemPlace; heading: HeadingPlace } {
	if (row.kind === 'item') return { item: { after: row.line }, heading: { afterItem: row.line } };
	return { item: { firstUnder: row.line }, heading: { afterSection: row.line } };
}

/** The Undo message for `change` on `written.changed` items, naming the items a tick skipped because they can't repeat. */
export function changeMessage(change: GroupChange, written: Pick<PlannedGroupChange, 'changed' | 'skipped'>): string {
	const items = countPhrase(written.changed, 0);
	const said = {
		tick: `${items} ticked.`,
		untick: `${items} unticked.`,
		addStar: `${items} starred.`,
		removeStar: `Star removed from ${items}.`,
		setDate: `Date set on ${items}.`,
		removeDate: `Date removed from ${items}.`,
	}[change];
	if (written.skipped === 0) return said;
	return `${said} ${written.skipped} ${written.skipped === 1 ? 'item' : 'items'} that can't repeat skipped.`;
}

/** What a tag entry changed, for its Undo message. */
export type TagChange = 'addTag' | 'removeTag';

/** The Undo message for `change` of `tag` on the `items` and `headings` the write touched. */
export function tagChangeMessage(change: TagChange, tag: string, items: number, headings: number): string {
	const rows = countPhrase(items, headings);
	return change === 'addTag' ? `#${tag} added to ${rows}.` : `#${tag} removed from ${rows}.`;
}

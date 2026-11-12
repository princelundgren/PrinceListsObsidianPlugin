import { countPhrase, type GroupState, type PlannedGroupChange } from './group-edits';

/** An entry of the selection's menu. */
export type GroupEntry = 'move' | 'tick' | 'untick' | 'addStar' | 'removeStar' | 'today' | 'tomorrow' | 'pickDate' | 'removeDate' | 'delete';

/** The entries mobile's bar shows one group of at a time. */
export type EntryGroup = 'tick' | 'star' | 'date';

/** What a tick, star or date entry changed, for its Undo message. */
export type GroupChange = 'tick' | 'untick' | 'addStar' | 'removeStar' | 'setDate' | 'removeDate';

const ENTRY_GROUPS: Record<EntryGroup, readonly GroupEntry[]> = {
	tick: ['tick', 'untick'],
	star: ['addStar', 'removeStar'],
	date: ['today', 'tomorrow', 'pickDate', 'removeDate'],
};

/**
 * The entries for a selection that holds `state`, in the menu's order, or only `only`'s group of them.
 * An entry with nothing to change hides. Move shows only while no heading is selected, in a list with
 * headings.
 */
export function groupEntries(state: GroupState, listHasHeadings: boolean, only?: EntryGroup): GroupEntry[] {
	const shows: Record<GroupEntry, boolean> = {
		move: listHasHeadings && state.headings === 0 && state.items > 0,
		tick: state.anyUnticked,
		untick: state.anyTicked,
		addStar: state.anyUnstarred,
		removeStar: state.anyStarred,
		today: state.items > 0,
		tomorrow: state.items > 0,
		pickDate: state.items > 0,
		removeDate: state.anyDated,
		delete: state.items + state.headings > 0,
	};
	const order = only ? ENTRY_GROUPS[only] : (Object.keys(shows) as GroupEntry[]);
	return order.filter((entry) => shows[entry]);
}

/** A button of mobile's bar that acts on the selection. */
export type BarButton = 'move' | EntryGroup | 'delete';

/**
 * Whether each of the bar's buttons has something to act on for a selection that holds `state`: Move
 * to while Move to heading… shows, Tick, Star and Date while any entry of their group does, and Delete
 * while anything is selected.
 */
export function barButtons(state: GroupState, listHasHeadings: boolean): Record<BarButton, boolean> {
	const entries = groupEntries(state, listHasHeadings);
	const showsAny = (group: EntryGroup): boolean => ENTRY_GROUPS[group].some((entry) => entries.includes(entry));
	return {
		move: entries.includes('move'),
		tick: showsAny('tick'),
		star: showsAny('star'),
		date: showsAny('date'),
		delete: entries.includes('delete'),
	};
}

/** The Undo message for `change` on `written.changed` items, naming the repeating items a tick skipped. */
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
	return `${said} ${written.skipped} repeating ${written.skipped === 1 ? 'item' : 'items'} skipped.`;
}

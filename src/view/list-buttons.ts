import { setTooltip } from 'obsidian';
import { SCHEDULE_ICON } from '../constants';
import { labelWithKey } from '../core/key-name';
import { isListText } from '../obsidian/marker';
import { openSchedule } from '../obsidian/open-schedule';
import { hasNoItems, placesFloatingAdd, syncNewItemButton } from './add-button';
import { ARCHIVED_TOGGLE_CLASS, FILTER_ICON, syncFilterButton, syncStarredToggle, toggleFilter } from './filter';
import { ARCHIVED_KEY_NAME, FIND_KEY_NAME } from './keys';
import type { PrinceListView } from './list-view';
import { syncSelectionBar } from './selection-bar';

/** Adds the list's two header actions, filter and schedule, to the view; `syncButtons` shows them. */
export function addHeaderActions(view: PrinceListView): void {
	view.findAction = view.addAction(FILTER_ICON, labelWithKey('Filter list', FIND_KEY_NAME), () => toggleFilter(view));
	// Each action goes left of the ones before, so this one sits leftmost.
	view.scheduleAction = view.addAction(SCHEDULE_ICON, 'Open schedule', () => void openSchedule(view.app.workspace));
}

/**
 * Shows or hides the view's buttons, and the selection bar, to match the text, the settings and
 * selecting. On mobile, editing also hides the floating "+".
 */
export function syncButtons(view: PrinceListView): void {
	const isList = isListText(view.text);
	// The room below the last row stays while the "+" hides for editing, so the list doesn't move.
	view.contentEl.toggleClass('princelists-has-floating-add', placesFloatingAdd(view));
	syncNewItemButton(view);
	view.scheduleAction?.toggle(isList && view.settings().showScheduleButton);
	syncFindButtons(view);
	syncSelectionBar(view);
}

/** Follows a change to where the floating "+" shows: an empty list is drawn again, since its hint names it. */
export function syncAddButtons(view: PrinceListView): void {
	if (hasNoItems(view)) view.render();
	else syncButtons(view);
}

// The header's filter icon shows only on a list, pressed while the field is open. The toggles in
// the field's row are lit while archived items show and while only starred ones do.
function syncFindButtons(view: PrinceListView): void {
	if (view.findAction) {
		view.findAction.toggle(isListText(view.text));
		syncFilterButton(view.findAction, view);
	}
	syncStarredToggle(view.filterField, view.starredOnly);
	const button = view.filterField?.rowEl.querySelector<HTMLElement>(`.${ARCHIVED_TOGGLE_CLASS}`);
	if (!button) return;
	button.toggleClass('princelists-archived-shown', view.showArchived);
	button.setAttribute('aria-pressed', String(view.showArchived));
	setTooltip(button, labelWithKey(view.showArchived ? 'Hide archived items' : 'Show archived items', ARCHIVED_KEY_NAME));
}

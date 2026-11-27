import { getLanguage, Notice } from 'obsidian';
import { VIEW_TYPE_LIST } from '../constants';
import { toggleItem } from '../core/edit-items';
import { joinLines, splitLines } from '../core/lines';
import { itemAt, parseList } from '../core/parse';
import type { ScheduledItem, ScheduleGroup } from '../core/schedule';
import { backDayMessage } from '../core/when';
import { editListFile } from '../obsidian/file-edit';
import { contentStartLine } from '../obsidian/marker';
import { openAsList } from '../obsidian/switch';
import { closeCard } from './card';
import { COLLAPSE_CLASS } from './collapse';
import { targetOf } from './dom';
import { FIND_BUTTON_CLASS, STARRED_TOGGLE_CLASS, toggleFilter, toggleStarredOnly } from './filter';
import { PrinceListView } from './list-view';
import { handleLinkClick } from './notes';
import { openItem } from './open-item';
import { HEADING_CLASS, ITEM_CLASS, TICK_SELECTOR } from './render-list';
import { LIST_HEADING_CLASS } from './schedule-row';
import { listRead } from './schedule-lists';
import type { ScheduleView } from './schedule-view';
import { stripClick } from './tag-strip';
import { CHANGED_ELSEWHERE_NOTICE, tryEdit } from './write';

export const GROUP_BUTTON_CLASS = 'princelists-group-button';

/** Handles a click anywhere in the Schedule: its buttons, group headings, list headings and rows. */
export function onScheduleClick(view: ScheduleView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (target && stripClick(view, target)) return;
	if (target?.closest(`.${GROUP_BUTTON_CLASS}`)) {
		view.grouping.setByList(!view.grouping.byList());
		return;
	}
	if (target?.closest(`.${FIND_BUTTON_CLASS}`)) {
		toggleFilter(view);
		return;
	}
	if (target?.closest(`.${STARRED_TOGGLE_CLASS}`)) {
		toggleStarredOnly(view);
		return;
	}
	const heading = target?.closest(`.${COLLAPSE_CLASS}`)?.closest(`.${HEADING_CLASS}`);
	const group = heading && view.headings.get(heading);
	if (group) {
		toggleGroup(view, group);
		return;
	}
	const listHeading = target?.closest(`.${LIST_HEADING_CLASS}`);
	const listPath = listHeading && view.listHeadings.get(listHeading);
	if (listPath) {
		void openList(view, listPath);
		return;
	}
	const rowEl = target?.closest(`.${ITEM_CLASS}`);
	const item = rowEl && view.rows.get(rowEl);
	if (!target || !item || handleLinkClick(view.app, item.listPath, evt, target)) return;
	if (target.closest(TICK_SELECTOR)) {
		// The box shows the file: the redraw after the write ticks it.
		evt.preventDefault();
		void view.enqueue(() => tick(view, item));
	} else {
		void openItemInList(view, item);
	}
}

function toggleGroup(view: ScheduleView, group: ScheduleGroup): void {
	if (!view.collapsed.delete(group)) view.collapsed.add(group);
	view.draw();
}

async function tick(view: ScheduleView, item: ScheduledItem): Promise<void> {
	const list = view.lists.get(item.listPath);
	const file = view.app.vault.getFileByPath(item.listPath);
	if (!list || !file) {
		new Notice(CHANGED_ELSEWHERE_NOTICE);
		return;
	}
	const lines = splitLines(list.text);
	const block = itemAt(parseList(lines, contentStartLine(list.text)), item.titleLine);
	// A change since the row was drawn may have put another item on its line.
	if (!block || lines[item.titleLine]?.text !== item.line) {
		new Notice(CHANGED_ELSEWHERE_NOTICE);
		return;
	}
	const toggled = tryEdit(() => toggleItem(lines, block, new Date()));
	if (!toggled) return;
	const next = joinLines(toggled.lines);
	// Taken at once, so the next tick in this list builds on it before the metadata cache catches up.
	if ((await editListFile(view.app, file, list.text, next)) !== 'written') return;
	listRead(view, file, next);
	if (toggled.back !== null) new Notice(backDayMessage(toggled.back, getLanguage()));
}

async function openList(view: ScheduleView, path: string): Promise<void> {
	const listView = await showList(view, path);
	if (listView) closeCard(listView);
}

async function openItemInList(view: ScheduleView, item: ScheduledItem): Promise<void> {
	const listView = await showList(view, item.listPath);
	if (listView) openItem(listView, item.titleLine, item.line);
}

// In a tab that already shows the list, else a new one. Null when the list is gone, or its view didn't load.
async function showList(view: ScheduleView, path: string): Promise<PrinceListView | null> {
	const file = view.app.vault.getFileByPath(path);
	if (!file) {
		new Notice(CHANGED_ELSEWHERE_NOTICE);
		return null;
	}
	const { workspace } = view.app;
	// By its state, which a tab restored in the background keeps while its view waits to load.
	const shown = workspace.getLeavesOfType(VIEW_TYPE_LIST).find((leaf) => leaf.getViewState().state?.file === file.path);
	const leaf = shown ?? workspace.getLeaf('tab');
	if (!(leaf.view instanceof PrinceListView && leaf.view.file === file)) await openAsList(leaf, file);
	workspace.setActiveLeaf(leaf, { focus: true });
	return leaf.view instanceof PrinceListView && leaf.view.file === file ? leaf.view : null;
}

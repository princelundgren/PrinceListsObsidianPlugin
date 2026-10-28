import { Menu, Notice } from 'obsidian';
import { SCHEDULE_ICON } from '../constants';
import { collapseChoices } from '../core/collapsed';
import type { TrackedLine } from '../core/editing';
import { endOfSection, sectionLastLine } from '../core/list-actions';
import { itemAt, type ItemBlock, type ListModel, type Section } from '../core/parse';
import { contentStartLine, isListText } from '../obsidian/marker';
import { openSchedule } from '../obsidian/open-schedule';
import { editInMarkdown } from '../obsidian/switch';
import { addItem, followPlace } from './add-button';
import { focusCardTitle, isNewEmptyItem } from './card';
import { deleteHeadingAt, deleteItemAt } from './delete';
import { addHeading, openHeadingField } from './heading-field';
import type { PrinceListView } from './list-view';
import { HEADING_CLASS, ITEM_CLASS, lineOf } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, SAVE_FAILED_NOTICE } from './write';

// The item actions, from a right-click on desktop and the card's ⋯ (spec, "Item actions").
export function itemMenu(view: PrinceListView, item: ItemBlock, menu: Menu): void {
	const anchor = trackWhileShown(view, item.titleLine, menu);
	menu.addItem((entry) =>
		entry
			.setTitle('New item below')
			.setIcon('list-plus')
			.onClick(atLine(anchor, (line) => newItemBelow(view, line))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('New heading below')
			.setIcon('heading')
			.onClick(atLine(anchor, (line) => addHeading(view, { afterItem: line }))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Edit in Markdown')
			.setIcon('file-text')
			.onClick(atLine(anchor, (line) => editItemInMarkdown(view, line))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Delete')
			.setIcon('trash-2')
			.setWarning(true)
			.onClick(atLine(anchor, (line) => deleteItemAt(view, line))),
	);
}

// The heading actions, from a right-click on desktop and a tap on mobile.
export function headingMenu(view: PrinceListView, model: ListModel, section: Section, menu: Menu): void {
	if (section.headingLine === null) return;
	const anchor = trackWhileShown(view, section.headingLine, menu);
	menu.addItem((entry) =>
		entry
			.setTitle('New item')
			.setIcon('list-plus')
			.onClick(atLine(anchor, (line) => addItem(view, { firstUnder: line }))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('New heading below')
			.setIcon('heading')
			.onClick(atLine(anchor, (line) => addHeading(view, { afterSection: line }))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Rename heading')
			.setIcon('pencil')
			.onClick(atLine(anchor, (line) => openHeadingField(view, line))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Edit in Markdown')
			.setIcon('file-text')
			.onClick(atLine(anchor, (line) => editItemInMarkdown(view, line))),
	);
	addCollapseAllEntries(view, model, menu);
	menu.addSeparator();
	menu.addItem((entry) =>
		entry
			.setTitle('Delete heading')
			.setIcon('trash-2')
			.setWarning(true)
			.onClick(atLine(anchor, (line) => deleteHeadingAt(view, line))),
	);
}

// The list's own actions, from a right-click on its background on desktop. New item and New heading
// go at the end of the section clicked in (spec, "Right-click menus").
export function listMenu(view: PrinceListView, model: ListModel, section: Section, menu: Menu): void {
	const itemPlace = endOfSection(section);
	const itemAnchor = itemPlace === 'first' ? null : trackWhileShown(view, 'after' in itemPlace ? itemPlace.after : itemPlace.firstUnder, menu);
	const headingAnchor = section.headingLine === null ? null : trackWhileShown(view, section.headingLine, menu);
	const lastLine = trackWhileShown(view, sectionLastLine(view.lines(), section, contentStartLine(view.text)), menu);
	menu.addItem((entry) =>
		entry
			.setTitle('New item')
			.setIcon('list-plus')
			.onClick(atAnchor(itemAnchor, (line) => {
				const place = followPlace(itemPlace, line);
				if (place) addItem(view, place);
			})),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('New heading')
			.setIcon('heading')
			.onClick(atAnchor(headingAnchor, (line) => addHeading(view, line === null ? 'top' : { afterSection: line }))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Edit in Markdown')
			.setIcon('file-text')
			.onClick(atLine(lastLine, (line) => editItemInMarkdown(view, line))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Show archived')
			.setIcon('archive')
			.setChecked(view.showArchived)
			.onClick(() => view.toggleArchived()),
	);
	addCollapseAllEntries(view, model, menu);
	menu.addSeparator();
	menu.addItem((entry) =>
		entry
			.setTitle('Open schedule')
			.setIcon(SCHEDULE_ICON)
			.onClick(() => void openSchedule(view.app.workspace)),
	);
}

function addCollapseAllEntries(view: PrinceListView, model: ListModel, menu: Menu): void {
	const { canCollapse, canExpand } = collapseChoices(headingLinesOf(model), view.collapsed.lines());
	if (!canCollapse && !canExpand) return;
	menu.addSeparator();
	if (canCollapse) {
		menu.addItem((entry) =>
			entry
				.setTitle('Collapse all headings')
				.setIcon('chevrons-down-up')
				.onClick(() => {
					// Read again: the list can change while the menu is open.
					view.collapsed.collapseAll(headingLinesOf(view.parse().model));
					view.render();
				}),
		);
	}
	if (canExpand) {
		menu.addItem((entry) =>
			entry
				.setTitle('Expand all headings')
				.setIcon('chevrons-up-down')
				.onClick(() => {
					// Also drops collapsed lines that are no longer headings, which nothing shows.
					view.collapsed.clear();
					view.render();
				}),
		);
	}
}

function headingLinesOf(model: ListModel): number[] {
	return model.sections.flatMap(({ headingLine }) => (headingLine === null ? [] : [headingLine]));
}

// A right-click on desktop: a row's or a heading's menu, else the list's. A field keeps the menu it
// has of its own.
export function showContextMenu(view: PrinceListView, evt: MouseEvent, target: HTMLElement): void {
	if (target.closest('textarea, input:not([type="checkbox"])')) return;
	const menu = menuAt(view, target) ?? backgroundMenu(view, evt);
	if (!menu) return;
	evt.preventDefault();
	menu.showAtMouseEvent(evt);
}

// Obsidian makes a contextmenu on mobile after a still hold, and holding a row or a heading opens no
// menu (spec, "Touch on mobile"). The view's listener cancels it in the capture phase. WebKit
// still sends a click when the finger lifts, which the view swallows.
export function cancelHoldMenu(view: PrinceListView, evt: MouseEvent, target: HTMLElement): void {
	if (target.closest('textarea') || !target.closest(`.${ITEM_CLASS}, .${HEADING_CLASS}`)) return;
	evt.preventDefault();
	evt.stopPropagation();
	view.swallowNextClick = true;
}

// A tap on a heading on mobile. True when it opened the heading's menu.
export function showHeadingMenu(view: PrinceListView, evt: MouseEvent, target: HTMLElement): boolean {
	const heading = target.closest<HTMLElement>(`.${HEADING_CLASS}`);
	const menu = heading ? menuAt(view, heading) : null;
	menu?.showAtMouseEvent(evt);
	return menu !== null;
}

// The open card's ⋯, opening below the button.
export function showCardMenu(view: PrinceListView, button: HTMLElement): void {
	const line = view.selected;
	const item = line === null ? undefined : itemAt(view.parse().model, line);
	if (!item) return;
	const menu = new Menu();
	itemMenu(view, item, menu);
	const { left, bottom, width } = button.getBoundingClientRect();
	menu.showAtPosition({ x: left, y: bottom, width, overlap: true, left: true }, button.doc);
}

function menuAt(view: PrinceListView, target: HTMLElement): Menu | null {
	const row = target.closest(`.${ITEM_CLASS}`);
	const heading = row ? null : target.closest(`.${HEADING_CLASS}`);
	const line = row ? lineOf(row) : heading ? lineOf(heading) : null;
	if (line === null) return null;
	const { model } = view.parse();
	const item = row ? itemAt(model, line) : undefined;
	const section = heading ? model.sections.find((s) => s.headingLine === line) : undefined;
	if (!item && !section) return null;
	const menu = new Menu();
	if (item) itemMenu(view, item, menu);
	else if (section) headingMenu(view, model, section, menu);
	return menu;
}

function backgroundMenu(view: PrinceListView, evt: MouseEvent): Menu | null {
	if (!isListText(view.text)) return null;
	const { model } = view.parse();
	let section = model.sections[0] as Section;
	for (const heading of view.contentEl.querySelectorAll<HTMLElement>(`.${HEADING_CLASS}`)) {
		if (heading.getBoundingClientRect().top > evt.clientY) break;
		const line = lineOf(heading);
		if (line !== null) section = model.sections.find((s) => s.headingLine === line) ?? section;
	}
	const menu = new Menu();
	listMenu(view, model, section, menu);
	return menu;
}

// New item below. On an empty item the open card added, that item is the new one: closing the card
// would remove it, only for the new item to take its place.
function newItemBelow(view: PrinceListView, line: number): void {
	if (isNewEmptyItem(view, line)) focusCardTitle(view);
	else addItem(view, { after: line });
}

// Typing waits 2 seconds to be saved, so it is saved first for the Markdown to show it.
function editItemInMarkdown(view: PrinceListView, line: number): void {
	const file = view.file;
	if (!file) return;
	enqueueAt(view, line, async (pending) => {
		try {
			await view.save();
		} catch (error) {
			console.error(error);
			new Notice(SAVE_FAILED_NOTICE);
			return;
		}
		if (pending?.line != null) await editInMarkdown(view.app.workspace, file, pending.line);
	});
}

// The menu's line follows the view's edits while it shows: on mobile, the tap that opened it also
// closed the card, which can remove an empty item above it meanwhile.
function trackWhileShown(view: PrinceListView, line: number, menu: Menu): TrackedLine {
	const anchor = view.editing.track(line);
	menu.onHide(() => view.editing.untrack(anchor));
	return anchor;
}

// A place with no line to track, the part before the first heading, acts with null.
function atAnchor(anchor: TrackedLine | null, action: (line: number | null) => void): () => void {
	return anchor ? atLine(anchor, action) : () => action(null);
}

function atLine(anchor: TrackedLine, action: (line: number) => void): () => void {
	return () => {
		if (anchor.line === null) new Notice(CHANGED_ELSEWHERE_NOTICE);
		else action(anchor.line);
	};
}

import { Menu, Notice } from 'obsidian';
import type { TrackedLine } from '../core/editing';
import { itemAt, type ItemBlock, type Section } from '../core/parse';
import { addItem } from './add-button';
import { focusCardTitle, isNewEmptyItem } from './card';
import { deleteHeadingAt, deleteItemAt } from './delete';
import { addHeading, openHeadingField } from './heading-field';
import type { PrinceListView } from './list-view';
import { HEADING_CLASS, ITEM_CLASS, lineOf } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE } from './write';

// The item actions, from a right-click on the Mac and the card's ⋯ (spec, "Item actions").
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
			.setTitle('Delete')
			.setIcon('trash-2')
			.setWarning(true)
			.onClick(atLine(anchor, (line) => deleteItemAt(view, line))),
	);
}

// The heading actions, from a right-click on the Mac and a tap on the iPhone.
export function headingMenu(view: PrinceListView, section: Section, menu: Menu): void {
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
			.setTitle('Delete heading')
			.setIcon('trash-2')
			.setWarning(true)
			.onClick(atLine(anchor, (line) => deleteHeadingAt(view, line))),
	);
}

// A right-click on a row or a heading, on the Mac. A field keeps the menu it has of its own.
export function showContextMenu(view: PrinceListView, evt: MouseEvent, target: HTMLElement): void {
	if (target.closest('textarea')) return;
	const menu = menuAt(view, target);
	if (!menu) return;
	evt.preventDefault();
	menu.showAtMouseEvent(evt);
}

// Obsidian makes a contextmenu on the iPhone after a still hold, and holding a row or a heading opens no
// menu (spec, "Touch on the iPhone"). The view's listener cancels it in the capture phase. WebKit
// still sends a click when the finger lifts, which the view swallows.
export function cancelHoldMenu(view: PrinceListView, evt: MouseEvent, target: HTMLElement): void {
	if (target.closest('textarea') || !target.closest(`.${ITEM_CLASS}, .${HEADING_CLASS}`)) return;
	evt.preventDefault();
	evt.stopPropagation();
	view.swallowNextClick = true;
}

// A tap on a heading on the iPhone. True when it opened the heading's menu.
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
	else if (section) headingMenu(view, section, menu);
	return menu;
}

// New item below. On an empty item the open card added, that item is the new one: closing the card
// would remove it, only for the new item to take its place.
function newItemBelow(view: PrinceListView, line: number): void {
	if (isNewEmptyItem(view, line)) focusCardTitle(view);
	else addItem(view, { after: line });
}

// The menu's line follows the view's edits while it shows: on the iPhone, the tap that opened it also
// closed the card, which can remove an empty item above it meanwhile.
function trackWhileShown(view: PrinceListView, line: number, menu: Menu): TrackedLine {
	const anchor = view.editing.track(line);
	menu.onHide(() => view.editing.untrack(anchor));
	return anchor;
}

function atLine(anchor: TrackedLine, action: (line: number) => void): () => void {
	return () => {
		if (anchor.line === null) new Notice(CHANGED_ELSEWHERE_NOTICE);
		else action(anchor.line);
	};
}

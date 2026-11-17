import { tagChangeMessage, type TagChange } from '../core/group-menu';
import { sharedCarried } from '../core/inherited-tags';
import { rowTexts, sameRowTexts } from '../core/row-texts';
import { planGroupTag, selectionTags } from '../core/selection-tags';
import { contentStartLine } from '../obsidian/marker';
import { queueGroupAction } from './group-write';
import type { PrinceListView } from './list-view';
import { stripTagOrder } from './tag-suggest';
import { closeTagsPopover, isTagsPopoverOpen, openTagsPopover } from './tags-popover';

/** Closes the popover and focuses `button` if it's open; opens it over `button` otherwise. */
export function toggleSelectionTagPopover(view: PrinceListView, button: HTMLElement): void {
	if (isTagsPopoverOpen(view)) {
		closeTagsPopover(view);
		button.focus();
	} else openSelectionTagPopover(view, button);
}

/**
 * Opens the tag popover over `button` for the selected items and headings: their tags as chips, each
 * with a × that takes it off them all, and a field whose pick gives a tag to them all. It closes once the view stops
 * selecting, or the selected rows or their text differ from those it opened with.
 */
export function openSelectionTagPopover(view: PrinceListView, button: HTMLElement): void {
	const lines = view.selection.lines();
	const { total, chips } = selectionTags(view.text, contentStartLine(view.text), lines, stripTagOrder(view));
	const opened = rowTexts(view.text, lines);
	openTagsPopover(view, {
		label: 'Tag the selection',
		anchor: () => button,
		side: 'above',
		button,
		chips: chips.map(({ tag, count }) => ({ tag, text: count === total ? `#${tag}` : `#${tag} ${count} of ${total}` })),
		// The selection when asked, which is the one it opened with: any change closes the popover.
		tagsToLeaveOut: () => {
			const { lines: parsed, model, inherited } = view.parse();
			return sharedCarried(parsed, model, inherited, view.selection.lines());
		},
		add: (tag) => changeTag(view, 'addTag', tag),
		remove: (tag) => changeTag(view, 'removeTag', tag),
		isStale: () => !view.selecting || !sameRowTexts(rowTexts(view.text, view.selection.lines()), opened),
	});
}

function changeTag(view: PrinceListView, change: TagChange, tag: string): void {
	queueGroupAction(
		view,
		view.selection.lines(),
		(text, contentStart, rows) => planGroupTag(text, contentStart, rows, change, tag),
		(written) => tagChangeMessage(change, tag, written.items, written.headings),
	);
}

import { setIcon } from 'obsidian';
import { itemTags } from '../core/item-tags';
import { addTag, removeTag } from '../core/tag-edit';
import { addHiddenLabel } from './dom';
import { queueLineEdit } from './line-edit';
import type { PrinceListView } from './list-view';
import { TagSuggest, type TagTarget } from './tag-suggest';

const CARD_TAGS_CLASS = 'princelists-card-tags';
const CARD_TAG_CLASS = 'princelists-card-tag';
const TAG_BUTTON_CLASS = 'princelists-card-tag-button';
const TAG_REMOVE_CLASS = 'princelists-card-tag-remove';
const TAG_POPOVER_CLASS = 'princelists-tag-popover';
export const CARD_HEAD_CLASS = 'princelists-card-head';
export const TAG_INPUT_CLASS = 'princelists-tag-input';

const tagOfRemove = new WeakMap<HTMLElement, string>();

/** Adds the "Add tag" button first in the card's `tools`, so the head reads tag, star, day, ⋯. */
export function buildTagButton(tools: HTMLElement): void {
	setIcon(tools.createEl('button', { cls: TAG_BUTTON_CLASS, attr: { 'aria-label': 'Add tag', 'aria-expanded': 'false' }, prepend: true }), 'tag');
}

/** Adds the card's tags box to `titleLine`, after the title, hidden until it has a tag. */
export function buildCardTags(titleLine: HTMLElement): void {
	titleLine.createDiv({ cls: CARD_TAGS_CLASS }).hide();
}

/**
 * Shows `tags` as chips in the card's tags box, each with a "Remove tag" ×, in place of the chips it
 * had. Chips that already show `tags` stay, so a press on a × outlives the redraw or blur it starts.
 * The box hides with no chip.
 */
export function showCardTags(cardEl: HTMLElement, tags: readonly string[]): void {
	const box = cardEl.querySelector<HTMLElement>(`.${CARD_TAGS_CLASS}`);
	if (!box) return;
	if (!showsTags(box, tags)) {
		box.empty();
		for (const tag of tags) {
			const chip = box.createSpan({ cls: ['princelists-tag', CARD_TAG_CLASS], text: `#${tag}` });
			const remove = chip.createEl('button', { cls: TAG_REMOVE_CLASS, attr: { 'aria-label': 'Remove tag' } });
			setIcon(remove, 'x');
			tagOfRemove.set(remove, tag);
		}
	}
	box.toggle(tags.length > 0);
}

// Exactly as written, not by sameTag: a tag whose case changed shows again.
function showsTags(box: HTMLElement, tags: readonly string[]): boolean {
	const shown = Array.from(box.querySelectorAll<HTMLElement>(`.${TAG_REMOVE_CLASS}`), (remove) => tagOfRemove.get(remove));
	return shown.length === tags.length && shown.every((tag, i) => tag === tags[i]);
}

/**
 * Opens the tag popover under the open card's tag button, with its type-ahead, and focuses its field;
 * closes it if it's open, focusing the tag button.
 */
export function toggleTagPopover(view: PrinceListView): void {
	if (view.tagPopover) {
		escapeTagPopover(view);
		return;
	}
	const button = tagButtonOf(view);
	const head = button?.closest<HTMLElement>(`.${CARD_HEAD_CLASS}`);
	if (!button || !head) return;
	const el = head.createDiv({ cls: TAG_POPOVER_CLASS });
	const input = el.createEl('input', { cls: TAG_INPUT_CLASS, type: 'text', attr: { placeholder: 'Tag' } });
	addHiddenLabel(input, 'Add tag');
	view.tagPopover = { el, input, suggest: new TagSuggest(view, input, cardTagTarget(view)) };
	button.setAttr('aria-expanded', 'true');
	input.focus();
	el.scrollIntoView({ block: 'nearest' });
}

// The open card's item when asked, which may have moved since the popover opened.
function cardTagTarget(view: PrinceListView): TagTarget {
	return {
		tagsToLeaveOut: () => itemTags(view.selected === null ? '' : (view.parse().lines[view.selected]?.text ?? '')).tags,
		choose: (tag) => {
			if (view.selected !== null) queueLineEdit(view, view.selected, (text) => addTag(text, tag));
			escapeTagPopover(view);
		},
	};
}

/** Closes the tag popover and its suggestions, whose own popover sits outside the view's element. */
export function closeTagPopover(view: PrinceListView): void {
	const open = view.tagPopover;
	if (!open) return;
	view.tagPopover = null;
	open.suggest.close();
	open.el.remove();
	tagButtonOf(view)?.setAttr('aria-expanded', 'false');
}

/** Closes the tag popover and focuses the tag button, so the card keeps focus. */
export function escapeTagPopover(view: PrinceListView): void {
	closeTagPopover(view);
	tagButtonOf(view)?.focus();
}

/** Whether `target` is the open card's tag button while its popover is open. */
export function isOpenTagButton(view: PrinceListView, target: HTMLElement): boolean {
	return view.tagPopover !== null && target.closest(`.${TAG_BUTTON_CLASS}`) !== null;
}

/**
 * Opens or closes the tag popover for a click on the tag button, or takes a tag off the open card's
 * item for one on a chip's ×. Returns whether `target` was on either.
 */
export function cardTagsClick(view: PrinceListView, target: HTMLElement): boolean {
	if (target.closest(`.${TAG_BUTTON_CLASS}`)) {
		toggleTagPopover(view);
		return true;
	}
	const remove = target.closest<HTMLElement>(`.${TAG_REMOVE_CLASS}`);
	const tag = remove ? tagOfRemove.get(remove) : undefined;
	if (!remove || tag === undefined) return false;
	// The redraw after the write takes the ×, which would drop focus out of the card.
	if (remove.doc.activeElement === remove) tagButtonOf(view)?.focus();
	if (view.selected !== null) queueLineEdit(view, view.selected, (text) => removeTag(text, tag));
	return true;
}

function tagButtonOf(view: PrinceListView): HTMLElement | null {
	return view.card?.el.querySelector<HTMLElement>(`.${TAG_BUTTON_CLASS}`) ?? null;
}

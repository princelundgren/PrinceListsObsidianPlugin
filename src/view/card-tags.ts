import { setIcon } from 'obsidian';
import { removeTag } from '../core/tag-edit';
import { queueLineEdit } from './line-edit';
import type { PrinceListView } from './list-view';
import { TagSuggest } from './tag-suggest';

const CARD_TAGS_CLASS = 'princelists-card-tags';
const CARD_TAG_CLASS = 'princelists-card-tag';
const TAG_BUTTON_CLASS = 'princelists-card-tag-button';
const TAG_REMOVE_CLASS = 'princelists-card-tag-remove';
export const TAG_INPUT_CLASS = 'princelists-tag-input';

const tagOfRemove = new WeakMap<HTMLElement, string>();

/** Adds the "Add tag" button first in the card's `tools`, so the head reads tag, star, day, ⋯. */
export function buildTagButton(tools: HTMLElement): void {
	setIcon(tools.createEl('button', { cls: TAG_BUTTON_CLASS, attr: { 'aria-label': 'Add tag' }, prepend: true }), 'tag');
}

/** Adds the card's tags box to `body`, hidden until it has a tag or the tag input. */
export function buildCardTags(body: HTMLElement): void {
	body.createDiv({ cls: CARD_TAGS_CLASS }).hide();
}

/**
 * Shows `tags` as chips in the card's tags box, each with a "Remove tag" ×, in place of the chips it
 * had. Chips that already show `tags` stay, so a press on a × outlives the redraw or blur it starts.
 * An open tag input stays where it is, with its focus. The box hides with no chip and no input.
 */
export function showCardTags(cardEl: HTMLElement, tags: readonly string[]): void {
	const box = cardEl.querySelector<HTMLElement>(`.${CARD_TAGS_CLASS}`);
	if (!box) return;
	if (!showsTags(box, tags)) {
		for (const chip of Array.from(box.querySelectorAll(`.${CARD_TAG_CLASS}`))) chip.remove();
		const input = box.querySelector(`.${TAG_INPUT_CLASS}`);
		for (const tag of tags) {
			const chip = createSpan({ cls: ['princelists-tag', CARD_TAG_CLASS], text: `#${tag}` });
			const remove = chip.createEl('button', { cls: TAG_REMOVE_CLASS, attr: { 'aria-label': 'Remove tag' } });
			setIcon(remove, 'x');
			tagOfRemove.set(remove, tag);
			box.insertBefore(chip, input);
		}
	}
	toggleTagsBox(box);
}

// Exactly as written, not by sameTag: a tag whose case changed shows again.
function showsTags(box: HTMLElement, tags: readonly string[]): boolean {
	const shown = Array.from(box.querySelectorAll<HTMLElement>(`.${TAG_REMOVE_CLASS}`), (remove) => tagOfRemove.get(remove));
	return shown.length === tags.length && shown.every((tag, i) => tag === tags[i]);
}

function toggleTagsBox(box: HTMLElement): void {
	box.toggle(box.querySelector(`.${CARD_TAG_CLASS}, .${TAG_INPUT_CLASS}`) !== null);
}

/** Opens the tag input at the end of the open card's tags, with its type-ahead, and focuses it. */
export function openTagInput(view: PrinceListView): void {
	const box = view.card?.el.querySelector<HTMLElement>(`.${CARD_TAGS_CLASS}`);
	if (!box) return;
	if (!view.tagInput) {
		const input = box.createEl('input', { cls: TAG_INPUT_CLASS, type: 'text', attr: { placeholder: 'Tag' } });
		view.tagInput = { input, suggest: new TagSuggest(view, input) };
		toggleTagsBox(box);
	}
	view.tagInput.input.focus();
}

/** Closes the tag input and its suggestions, whose popover sits outside the view's element. */
export function closeTagInput(view: PrinceListView): void {
	const open = view.tagInput;
	if (!open) return;
	view.tagInput = null;
	open.suggest.close();
	const box = open.input.parentElement;
	open.input.remove();
	if (box) toggleTagsBox(box);
}

/** Escape in the tag input closes it; focus goes to the tag button, so the card keeps it. */
export function escapeTagInput(view: PrinceListView): void {
	closeTagInput(view);
	tagButtonOf(view)?.focus();
}

/**
 * Opens the tag input for a click on the tag button, or takes a tag off the open card's item for one
 * on a chip's ×. Returns whether `target` was on either.
 */
export function cardTagsClick(view: PrinceListView, target: HTMLElement): boolean {
	if (target.closest(`.${TAG_BUTTON_CLASS}`)) {
		openTagInput(view);
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

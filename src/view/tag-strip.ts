import { setIcon, setTooltip } from 'obsidian';
import { sameTag, toggleTag } from '../core/tags';
import { addHiddenLabel } from './dom';
import type { FilterHost } from './filter';

export const TAG_STRIP_CLASS = 'princelists-tag-strip';
export const STRIP_TAG_CLASS = 'princelists-strip-tag';
export const CLEAR_TAGS_CLASS = 'princelists-clear-tags';

const tagOfButton = new WeakMap<HTMLElement, string>();

/** Whether `view` shows its tag strip: always, or only while its filter field is open, as the setting says. */
export function showsTagStrip(view: FilterHost): boolean {
	return view.tagStripMode() === 'always' || view.filter !== null;
}

/**
 * Draws `view` again after the "Tag strip" setting changes. A strip that no longer shows takes its lit
 * tags with it, as closing the field does with "While filtering", so no hidden tag filters the rows.
 */
export function followTagStripMode(view: FilterHost): void {
	if (!showsTagStrip(view)) view.litTags = [];
	view.render();
}

/**
 * Adds the strip of `tags` to `parent`, or nothing for no tags: a toggle button per tag, pressed while
 * it is one of `lit`, then "Clear tags" while a tag is lit. The view's delegated click listener hands
 * a press on one to `stripClick`.
 */
export function buildTagStrip(parent: HTMLElement, tags: readonly string[], lit: readonly string[]): void {
	if (tags.length === 0) return;
	const strip = parent.createDiv({ cls: TAG_STRIP_CLASS, attr: { role: 'group' } });
	addHiddenLabel(strip, 'Tags');
	for (const tag of tags) {
		const isLit = lit.some((litTag) => sameTag(litTag, tag));
		const button = strip.createEl('button', { cls: STRIP_TAG_CLASS, text: `#${tag}`, attr: { 'aria-pressed': String(isLit) } });
		button.toggleClass('is-lit', isLit);
		tagOfButton.set(button, tag);
	}
	if (lit.length === 0) return;
	const clear = strip.createEl('button', { cls: CLEAR_TAGS_CLASS });
	setIcon(clear, 'x');
	setTooltip(clear, 'Clear tags');
}

/**
 * Lights or puts out the strip tag `target` is on, or every tag for "Clear tags", then draws `view`
 * again. Returns whether `target` was on one of the strip's buttons.
 */
export function stripClick(view: FilterHost, target: HTMLElement): boolean {
	const clear = target.closest<HTMLElement>(`.${CLEAR_TAGS_CLASS}`);
	const tagButton = target.closest<HTMLElement>(`.${STRIP_TAG_CLASS}`);
	const tag = tagButton ? tagOfButton.get(tagButton) : undefined;
	const pressed = clear ?? (tag === undefined ? null : tagButton);
	if (!pressed) return false;
	const strip = pressed.closest(`.${TAG_STRIP_CLASS}`);
	const hadFocus = strip?.contains(pressed.doc.activeElement) ?? false;
	view.litTags = tag === undefined ? [] : toggleTag(view.litTags, tag);
	view.render();
	if (hadFocus) focusStrip(view, tag ?? null);
	return true;
}

// The pressed button was drawn again, so focus would fall to the page and the view's own keys would
// stop working: it goes to the same tag, else the strip's first, else the view.
function focusStrip(view: FilterHost, tag: string | null): void {
	const buttons = Array.from(view.contentEl.querySelectorAll<HTMLElement>(`.${STRIP_TAG_CLASS}`));
	const same = tag === null ? undefined : buttons.find((button) => sameTag(tagOfButton.get(button) ?? '', tag));
	const next = same ?? buttons[0];
	if (next) next.focus();
	else view.app.workspace.setActiveLeaf(view.leaf, { focus: true });
}

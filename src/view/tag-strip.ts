import { setIcon, setTooltip } from 'obsidian';
import { isAnyLit, NO_LIT_TAGS, sameTag, toggleTag, type LitTags } from '../core/tags';
import { addHiddenLabel } from './dom';
import type { FilterHost } from './filter';

export const TAG_STRIP_CLASS = 'princelists-tag-strip';
export const STRIP_TAG_CLASS = 'princelists-strip-tag';
export const NO_TAG_CLASS = 'princelists-strip-no-tag';
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
	if (!showsTagStrip(view)) view.litTags = NO_LIT_TAGS;
	view.render();
}

/**
 * Adds the strip of `tags` to `parent`, or nothing for no tags: No tag, then a toggle button per tag,
 * each pressed while `lit` holds it, then "Clear tags" while anything is lit. The view's delegated
 * click listener hands a press on one to `stripClick`.
 */
export function buildTagStrip(parent: HTMLElement, tags: readonly string[], lit: LitTags): void {
	if (tags.length === 0) return;
	const strip = parent.createDiv({ cls: TAG_STRIP_CLASS, attr: { role: 'group' } });
	addHiddenLabel(strip, 'Tags');
	addToggle(strip, NO_TAG_CLASS, 'No tag', lit.untagged);
	for (const tag of tags) {
		const button = addToggle(strip, STRIP_TAG_CLASS, `#${tag}`, lit.tags.some((litTag) => sameTag(litTag, tag)));
		tagOfButton.set(button, tag);
	}
	if (!isAnyLit(lit)) return;
	const clear = strip.createEl('button', { cls: CLEAR_TAGS_CLASS });
	setIcon(clear, 'x');
	setTooltip(clear, 'Clear tags');
}

function addToggle(strip: HTMLElement, cls: string, text: string, isLit: boolean): HTMLElement {
	const button = strip.createEl('button', { cls, text, attr: { 'aria-pressed': String(isLit) } });
	button.toggleClass('is-lit', isLit);
	return button;
}

/** A press in the strip: on No tag, on a tag, or on "Clear tags". */
type StripPress = { kind: 'untagged' } | { kind: 'tag'; tag: string } | { kind: 'clear' };

function pressOn(target: HTMLElement): { button: HTMLElement; press: StripPress } | null {
	const button = target.closest<HTMLElement>(`.${NO_TAG_CLASS}, .${STRIP_TAG_CLASS}, .${CLEAR_TAGS_CLASS}`);
	if (!button) return null;
	if (button.hasClass(NO_TAG_CLASS)) return { button, press: { kind: 'untagged' } };
	if (button.hasClass(CLEAR_TAGS_CLASS)) return { button, press: { kind: 'clear' } };
	const tag = tagOfButton.get(button);
	return tag === undefined ? null : { button, press: { kind: 'tag', tag } };
}

function litAfter(lit: LitTags, press: StripPress): LitTags {
	switch (press.kind) {
		case 'untagged':
			return { ...lit, untagged: !lit.untagged };
		case 'tag':
			return { ...lit, tags: toggleTag(lit.tags, press.tag) };
		case 'clear':
			return NO_LIT_TAGS;
	}
}

/**
 * Lights or puts out No tag or the strip tag `target` is on, or everything for "Clear tags", then
 * draws `view` again. Returns whether `target` was on one of the strip's buttons.
 */
export function stripClick(view: FilterHost, target: HTMLElement): boolean {
	const pressed = pressOn(target);
	if (!pressed) return false;
	const strip = pressed.button.closest(`.${TAG_STRIP_CLASS}`);
	const hadFocus = strip?.contains(pressed.button.doc.activeElement) ?? false;
	view.litTags = litAfter(view.litTags, pressed.press);
	view.render();
	if (hadFocus) focusStrip(view, pressed.press);
	return true;
}

// The pressed button was drawn again, so focus would fall to the page and the view's own keys would
// stop working: it goes to the same button, else the strip's first, else the view.
function focusStrip(view: FilterHost, press: StripPress): void {
	const buttons = Array.from(view.contentEl.querySelectorAll<HTMLElement>(`.${NO_TAG_CLASS}, .${STRIP_TAG_CLASS}`));
	const same = buttons.find((button) => {
		if (press.kind === 'untagged') return button.hasClass(NO_TAG_CLASS);
		return press.kind === 'tag' && sameTag(tagOfButton.get(button) ?? '', press.tag);
	});
	const next = same ?? buttons[0];
	if (next) next.focus();
	else view.app.workspace.setActiveLeaf(view.leaf, { focus: true });
}

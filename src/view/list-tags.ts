import { Notice, setIcon } from 'obsidian';
import type { TagChange } from '../core/group-menu';
import { ownEdit } from '../core/follow';
import { expectedListTags, listTagsEditKind, planListTags } from '../core/list-tags-edit';
import { applyMarkerEdit } from '../core/marker-edit';
import { sameTag } from '../core/tags';
import { listTags, readFrontmatter, sameButTags } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import { openTagsPopover } from './tags-popover';
import { enqueueAt, writePlanned } from './write';

export const LIST_TAGS_CLASS = 'princelists-list-tags';
export const LIST_TAG_BUTTON_CLASS = 'princelists-list-tag-button';

export const LIST_TAGS_REFUSED_NOTICE = "The list's tags can't be changed here. Use Show file properties.";

/**
 * Opens the tag popover under the list's title, or above it when there is more room there: the tags
 * of its `tags` property as chips, each with a × that takes it off, and a field whose pick adds a
 * tag. It closes once the Markdown
 * differs from what it opened with, or the view has no title element. Nothing opens when the view
 * has no title element. Opened from the chips beside the title, `button` is theirs, which shows it
 * open and takes focus back.
 */
export function openListTags(view: PrinceListView, button: HTMLElement | null = null): void {
	const opened = view.text;
	const tags = listTags(opened);
	openTagsPopover(view, {
		label: 'Tag the list',
		anchor: () => view.listTitleEl,
		side: 'below',
		button,
		chips: tags.map((tag) => ({ tag, text: `#${tag}` })),
		tagsToLeaveOut: () => tags,
		add: (tag) => changeTag(view, 'addTag', tag),
		remove: (tag) => changeTag(view, 'removeTag', tag),
		isStale: () => view.text !== opened,
	});
}

/**
 * Draws the list's tags at the end of `row`, after its title, as one button whose press opens Tag
 * list…'s popover, then a tag icon button that opens it too, which styles.css shows only while the
 * title or the button holds focus. Returns the slot for the tag icon button when it is `kept`, the
 * focused element the redraw keeps.
 */
export function buildListTags(view: PrinceListView, row: HTMLElement, kept: HTMLElement | null): HTMLElement | null {
	const tags = listTags(view.text);
	if (tags.length > 0) {
		const names = tags.map((tag) => `#${tag}`);
		const chips = row.createEl('button', {
			cls: LIST_TAGS_CLASS,
			attr: { 'aria-label': `Tag list: ${names.join(', ')}`, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
		});
		for (const name of names) chips.createSpan({ cls: 'princelists-tag', text: name });
	}
	if (kept?.hasClass(LIST_TAG_BUTTON_CLASS)) return row.createDiv();
	const button = row.createEl('button', { cls: LIST_TAG_BUTTON_CLASS, attr: { 'aria-label': 'Tag list', 'aria-haspopup': 'dialog' } });
	setIcon(button, 'tag');
	return null;
}

function changeTag(view: PrinceListView, change: TagChange, tag: string): void {
	enqueueAt(view, null, async () => {
		let refused = false;
		const written = await writePlanned(view, (text) => {
			const plan = planListTags(text, readFrontmatter(text), change, tag);
			if (plan === null) return null;
			if ('refused' in plan) {
				refused = true;
				return null;
			}
			const next = applyMarkerEdit(text, plan);
			if (!isExpected(text, next, change, tag)) {
				refused = true;
				return null;
			}
			return { next, edit: ownEdit(plan.start, text, next, listTagsEditKind(plan)) };
		});
		if (written) view.render();
		if (refused) new Notice(LIST_TAGS_REFUSED_NOTICE);
	});
}

// Only the tags changed, and by exactly the one tag asked for.
function isExpected(before: string, after: string, change: TagChange, tag: string): boolean {
	if (!sameButTags(before, after)) return false;
	const want = expectedListTags(listTags(before), change, tag);
	const have = listTags(after);
	return have.length === want.length && want.every((one) => have.some((other) => sameTag(one, other)));
}

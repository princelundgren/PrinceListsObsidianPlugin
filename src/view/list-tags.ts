import { Notice } from 'obsidian';
import type { TagChange } from '../core/group-menu';
import { ownEdit } from '../core/follow';
import { expectedListTags, listTagsEditKind, planListTags } from '../core/list-tags-edit';
import { applyMarkerEdit } from '../core/marker-edit';
import { sameTag } from '../core/tags';
import { listTags, readFrontmatter, sameButTags } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import { openTagsPopover } from './tags-popover';
import { enqueueAt, writePlanned } from './write';

export const LIST_TAGS_REFUSED_NOTICE = "The list's tags can't be changed here. Use Show file properties.";

/**
 * Opens the tag popover under the list's title: the tags of its `tags` property as chips, each
 * with a × that takes it off, and a field whose pick adds a tag. It closes once the Markdown
 * differs from what it opened with, or the view has no title element. Nothing opens when the view
 * has no title element.
 */
export function openListTags(view: PrinceListView): void {
	const opened = view.text;
	const tags = listTags(opened);
	openTagsPopover(view, {
		label: 'Tag the list',
		anchor: () => view.listTitleEl,
		side: 'below',
		button: null,
		chips: tags.map((tag) => ({ tag, text: `#${tag}` })),
		tagsToLeaveOut: () => tags,
		add: (tag) => changeTag(view, 'addTag', tag),
		remove: (tag) => changeTag(view, 'removeTag', tag),
		isStale: () => view.text !== opened,
	});
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

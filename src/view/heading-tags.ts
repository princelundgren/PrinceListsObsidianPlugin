import { Notice } from 'obsidian';
import { headingText } from '../core/display';
import type { TagChange } from '../core/group-menu';
import type { HeadingSave } from '../core/heading-field';
import { headingEndTags, planHeadingTag } from '../core/heading-tags';
import { carriedTags } from '../core/inherited-tags';
import { inlineTags } from '../core/item-tags';
import { contentStartLine } from '../obsidian/marker';
import { NAME_REFUSED_NOTICE } from './heading-field';
import type { PrinceListView } from './list-view';
import { ownElement } from './own-rows';
import { HEADING_CLASS, LINE_ATTR } from './render-list';
import { openTagsPopover } from './tags-popover';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, writePlanned } from './write';

/**
 * Opens the tag popover below the heading on `line`: the tags at the end of its text as chips, each
 * with a × that takes it off, and a field whose pick adds a tag there. It closes once the Markdown
 * differs from what it opened with. Nothing opens when the heading isn't on screen.
 */
export function openHeadingTags(view: PrinceListView, line: number): void {
	const anchor = ownElement(view.contentEl, `.${HEADING_CLASS}[${LINE_ATTR}="${line}"]`);
	if (!anchor) return;
	const opened = view.text;
	const text = headingText(view.lines(), line);
	openTagsPopover(view, {
		label: 'Tag the heading',
		anchor,
		side: 'below',
		button: null,
		chips: headingEndTags(text).map((tag) => ({ tag, text: `#${tag}` })),
		tagsToLeaveOut: () => carriedTags(inlineTags(text), view.parse().inherited.list),
		add: (tag) => changeTag(view, line, 'addTag', tag),
		remove: (tag) => changeTag(view, line, 'removeTag', tag),
		isStale: () => view.text !== opened,
	});
}

function changeTag(view: PrinceListView, line: number, change: TagChange, tag: string): void {
	enqueueAt(view, line, async (pending) => {
		let save: HeadingSave = { kind: 'none' };
		await writePlanned(view, (text) => {
			save = pending?.line == null ? { kind: 'lost' } : planHeadingTag(text, contentStartLine(text), pending.line, change, tag);
			return save.kind === 'write' ? save : null;
		});
		tell(save);
	});
}

function tell(save: HeadingSave): void {
	if (save.kind === 'refused') new Notice(NAME_REFUSED_NOTICE);
	else if (save.kind === 'lost') new Notice(CHANGED_ELSEWHERE_NOTICE);
}

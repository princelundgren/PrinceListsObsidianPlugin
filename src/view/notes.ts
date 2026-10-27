import { Component, Keymap, MarkdownRenderer, Menu } from 'obsidian';
import { boxesMatchChecklist, type ChecklistLine } from '../core/checklist';
import { asInline, needsMarkdown } from '../core/inline';
import type { PrinceListView } from './list-view';

const INTERNAL_LINK = 'a.internal-link';
export const NOTES_CHECKBOX_SELECTOR = '.task-list-item-checkbox';

// Obsidian's own rendering, so pictures, links and embeds look as they do in any note (spec,
// "Rendering notes in the card"). Without a Component, embeds don't load and Obsidian logs a leak, so
// each block gets its own child of the view, which the caller removes on re-render or close. Links
// are handled by handleLinkClick and handleLinkMenu, delegated once on the view.
export function renderNotes(view: PrinceListView, el: HTMLElement, markdown: string): Component {
	// Notes outside the open card have no checklist, so their boxes stay disabled: they would tick on
	// screen and save nothing.
	return renderMarkdown(view, el, markdown, () => false);
}

// A card's notes, whose boxes tick their lines only while each box lines up with one.
export function renderCardNotes(view: PrinceListView, el: HTMLElement, markdown: string, checklist: readonly ChecklistLine[]): Component {
	return renderMarkdown(view, el, markdown, (boxes) => boxesMatchChecklist(boxes.map((box) => box.checked), checklist));
}

function renderMarkdown(
	view: PrinceListView,
	el: HTMLElement,
	markdown: string,
	boxesEnabled: (boxes: HTMLInputElement[]) => boolean,
): Component {
	const child = view.addChild(new Component());
	MarkdownRenderer.render(view.app, markdown, el, view.file?.path ?? '', child).then(
		() => {
			const boxes = Array.from(el.querySelectorAll<HTMLInputElement>(NOTES_CHECKBOX_SELECTOR));
			const enabled = boxesEnabled(boxes);
			for (const box of boxes) box.disabled = !enabled;
		},
		(error: unknown) => console.error(error),
	);
	return child;
}

// A title or heading, as Markdown that renders inline (spec, "Layout"). One without Markdown is set
// as text: on a long list, the renderer is what costs most. null when nothing was rendered.
export function renderInline(view: PrinceListView, el: HTMLElement, text: string): Component | null {
	if (!needsMarkdown(text)) {
		el.setText(text);
		return null;
	}
	return renderNotes(view, el, asInline(text));
}

// For the view's click listener. True when the click was on a link, which then does only what a link
// does: an internal one opens through the workspace, as in Kanban's renderMarkdown, and any other
// keeps the browser's default. Either way it doesn't tick an item or open a card.
export function handleLinkClick(view: PrinceListView, evt: MouseEvent, target: HTMLElement): boolean {
	const link = target.closest('a');
	if (!link) return false;
	if (link.matches(INTERNAL_LINK)) {
		evt.preventDefault();
		const linktext = linkText(link);
		if (linktext && view.file) void view.app.workspace.openLinkText(linktext, view.file.path, Keymap.isModEvent(evt));
	}
	return true;
}

// For the view's contextmenu listener, on the Mac only: the iPhone has no right-click, and the plugin
// opens no menu on a long-press (spec, "Layout"). True when the right-click was on an internal link,
// which then shows Obsidian's link menu and no other. No page previews: they wait until Obsidian
// documents the `hover-link` event's payload (spec, "Not in step one").
export function handleLinkMenu(view: PrinceListView, evt: MouseEvent, target: HTMLElement): boolean {
	const link = target.closest(INTERNAL_LINK);
	if (!link) return false;
	const href = linkText(link);
	if (!href || !view.file) return true;
	evt.preventDefault();
	const menu = new Menu();
	// It returns a boolean whose meaning isn't documented, so it isn't used.
	view.app.workspace.handleLinkContextMenu(menu, href, view.file.path);
	menu.showAtMouseEvent(evt);
	return true;
}

// As Kanban reads it: a Markdown-style link's `href` may be URL-encoded, while `data-href` holds the
// link text as written.
function linkText(link: Element): string | null {
	return link.getAttr('data-href') ?? link.getAttr('href');
}

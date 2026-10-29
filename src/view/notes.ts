import { Component, Keymap, MarkdownRenderer, Menu, type App } from 'obsidian';
import { isWebAddress } from '../core/drawn-links';
import { asInline, needsMarkdown } from '../core/inline';

const INTERNAL_LINK = 'a.internal-link';
export const NOTES_CHECKBOX_CLASS = 'task-list-item-checkbox';
export const NOTES_CHECKBOX_SELECTOR = `.${NOTES_CHECKBOX_CLASS}`;
/** The boxes the notes editor draws for its checklist lines, which it ticks, apart from rendered ones. */
export const NOTES_DRAWN_CHECKBOX_CLASS = 'princelists-notes-checkbox';
export const NOTES_DRAWN_CHECKBOX_SELECTOR = `.${NOTES_DRAWN_CHECKBOX_CLASS}`;

// What rendering Markdown needs: the app, and a component that each rendered block becomes a child of.
export interface MarkdownHost {
	readonly app: App;
	addChild<T extends Component>(component: T): T;
}

// Obsidian's own rendering, so pictures, links and embeds look as they do in any note (spec,
// "Rendering notes in the card"). Without a Component, embeds don't load and Obsidian logs a leak, so
// each block gets its own child of the host, which the caller removes on re-render or close. Links
// are handled by handleLinkClick and handleLinkMenu, delegated once on the host's container.
export function renderNotes(host: MarkdownHost, sourcePath: string, el: HTMLElement, markdown: string): Component {
	const child = host.addChild(new Component());
	MarkdownRenderer.render(host.app, markdown, el, sourcePath, child).then(
		() => {
			// A title has no checklist: its boxes would tick on screen and save nothing.
			for (const box of Array.from(el.querySelectorAll<HTMLInputElement>(NOTES_CHECKBOX_SELECTOR))) box.disabled = true;
		},
		(error: unknown) => console.error(error),
	);
	return child;
}

// A title or heading, as Markdown that renders inline (spec, "Layout"). One without Markdown is set
// as text: on a long list, the renderer is what costs most. null when nothing was rendered.
export function renderInline(host: MarkdownHost, sourcePath: string, el: HTMLElement, text: string): Component | null {
	if (!needsMarkdown(text)) {
		el.setText(text);
		return null;
	}
	return renderNotes(host, sourcePath, el, asInline(text));
}

// For a host's click listener. True when the click was on a link, which then does only what a link
// does: an internal one opens through the workspace, as in Kanban's renderMarkdown, and any other
// keeps the browser's default. In the notes editor, where the browser follows no link, a web address
// opens through `window.open`, as Obsidian opens a clicked one. Either way it doesn't tick an item or
// open a card.
export function handleLinkClick(app: App, sourcePath: string, evt: MouseEvent, target: HTMLElement): boolean {
	const link = target.closest('a');
	if (!link) return false;
	if (link.matches(INTERNAL_LINK)) {
		evt.preventDefault();
		const linktext = linkText(link);
		if (linktext) void app.workspace.openLinkText(linktext, sourcePath, Keymap.isModEvent(evt));
	} else if (link.isContentEditable) {
		evt.preventDefault();
		const href = link.getAttr('href');
		if (href && isWebAddress(href)) link.win.open(href, '_blank');
	}
	return true;
}

// For a host's contextmenu listener, on desktop only: mobile has no right-click, and the plugin
// opens no menu on a long-press (spec, "Layout"). True when the right-click was on an internal link,
// which then shows Obsidian's link menu and no other. No page previews: they wait until Obsidian
// documents the `hover-link` event's payload (spec, "Not in step one").
export function handleLinkMenu(app: App, sourcePath: string, evt: MouseEvent, target: HTMLElement): boolean {
	const link = target.closest(INTERNAL_LINK);
	if (!link) return false;
	const href = linkText(link);
	if (!href) return true;
	evt.preventDefault();
	const menu = new Menu();
	// It returns a boolean whose meaning isn't documented, so it isn't used.
	app.workspace.handleLinkContextMenu(menu, href, sourcePath);
	menu.showAtMouseEvent(evt);
	return true;
}

// As Kanban reads it: a Markdown-style link's `href` may be URL-encoded, while `data-href` holds the
// link text as written.
function linkText(link: Element): string | null {
	return link.getAttr('data-href') ?? link.getAttr('href');
}

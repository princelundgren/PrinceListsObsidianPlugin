import { Component, Keymap, MarkdownRenderer, Menu, type App } from 'obsidian';
import { boxesMatchChecklist, type ChecklistLine } from '../core/checklist';
import { asInline, needsMarkdown } from '../core/inline';

const INTERNAL_LINK = 'a.internal-link';
export const NOTES_CHECKBOX_SELECTOR = '.task-list-item-checkbox';

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
	// Notes outside the open card have no checklist, so their boxes stay disabled: they would tick on
	// screen and save nothing.
	return renderMarkdown(host, sourcePath, el, markdown, () => false);
}

// A card's notes, whose boxes tick their lines only while each box lines up with one.
export function renderCardNotes(
	host: MarkdownHost,
	sourcePath: string,
	el: HTMLElement,
	markdown: string,
	checklist: readonly ChecklistLine[] | null,
): Component {
	return renderMarkdown(host, sourcePath, el, markdown, (boxes) => boxesMatchChecklist(boxes.map((box) => box.checked), checklist));
}

function renderMarkdown(
	host: MarkdownHost,
	sourcePath: string,
	el: HTMLElement,
	markdown: string,
	boxesEnabled: (boxes: HTMLInputElement[]) => boolean,
): Component {
	const child = host.addChild(new Component());
	MarkdownRenderer.render(host.app, markdown, el, sourcePath, child).then(
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
export function renderInline(host: MarkdownHost, sourcePath: string, el: HTMLElement, text: string): Component | null {
	if (!needsMarkdown(text)) {
		el.setText(text);
		return null;
	}
	return renderNotes(host, sourcePath, el, asInline(text));
}

// For a host's click listener. True when the click was on a link, which then does only what a link
// does: an internal one opens through the workspace, as in Kanban's renderMarkdown, and any other
// keeps the browser's default. Either way it doesn't tick an item or open a card.
export function handleLinkClick(app: App, sourcePath: string, evt: MouseEvent, target: HTMLElement): boolean {
	const link = target.closest('a');
	if (!link) return false;
	if (link.matches(INTERNAL_LINK)) {
		evt.preventDefault();
		const linktext = linkText(link);
		if (linktext) void app.workspace.openLinkText(linktext, sourcePath, Keymap.isModEvent(evt));
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

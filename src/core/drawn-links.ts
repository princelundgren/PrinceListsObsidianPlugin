/** Where a Markdown link's address leads, as Obsidian draws it in a note. */
export type LinkTarget =
	| { kind: 'web'; href: string }
	/** A script or data address, which Obsidian draws as a link with no address. */
	| { kind: 'unsafe' }
	| { kind: 'vault'; linktext: string };

/** A picture's alt text and its `width` or `widthxheight` size in pixels, each null when unset. */
export interface PictureLook {
	alt: string | null;
	size: string | null;
}

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const UNSAFE_SCHEME = /^(javascript|vbscript|data):/i;
const SIZE = /^\d+(x\d+)?$/;
const WEB_ADDRESS = /^https?:/i;
const WIKI_EMBED = /^!\[\[([^|\]]*)(?:\|([^\]]*))?\]\]$/;
const MARKDOWN_IMAGE = /^!\[([^\]]*)\]/;

/** The target of `address`, a Markdown link's address as typed, `<…>` included. */
export function linkTarget(address: string): LinkTarget {
	const unwrapped = address.startsWith('<') && address.endsWith('>') ? address.slice(1, -1) : address;
	if (UNSAFE_SCHEME.test(unwrapped)) return { kind: 'unsafe' };
	if (URL_SCHEME.test(unwrapped)) return { kind: 'web', href: unwrapped };
	try {
		return { kind: 'vault', linktext: decodeURIComponent(unwrapped) };
	} catch {
		return { kind: 'vault', linktext: unwrapped };
	}
}

/** Whether `href` is an http or https address, the only kind the notes editor opens itself. */
export function isWebAddress(href: string): boolean {
	return WEB_ADDRESS.test(href);
}

/**
 * The look of a picture from its Markdown, `![[path|caption|size]]` or `![caption|size](path)`, as
 * Obsidian draws it: a last `|` part that is a size sets the size, and the caption is the alt text. A
 * wiki embed without a caption has its path as alt text, and a Markdown picture without one has none.
 */
export function pictureLook(markdown: string): PictureLook {
	const wiki = WIKI_EMBED.exec(markdown);
	const text = wiki ? (wiki[2] ?? '') : (MARKDOWN_IMAGE.exec(markdown)?.[1] ?? '');
	const bar = text.lastIndexOf('|');
	const last = text.slice(bar + 1);
	const size = SIZE.test(last) ? last : null;
	const caption = size === null ? text : text.slice(0, Math.max(bar, 0));
	return { alt: caption || (wiki ? (wiki[1] ?? null) : null), size };
}

const WIKILINK = /^\[\[([^[\]|]+)(?:\|[^[\]]*)?\]\]$/;

// The list a `princelists` code block names: its one non-blank line is a wikilink. The alias, if any,
// isn't part of the link.
export function blockLink(source: string): string | null {
	const lines = source.split('\n').map((line) => line.trim()).filter((line) => line !== '');
	if (lines.length !== 1) return null;
	return WIKILINK.exec(lines[0] as string)?.[1] ?? null;
}

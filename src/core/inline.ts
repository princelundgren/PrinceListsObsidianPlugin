// Characters Markdown or Obsidian give a meaning to inside a paragraph: escapes, code, emphasis,
// ~~, ==, links and embeds, HTML and entities, math, %% comments and #tags, plus bare URLs and email
// addresses, which Obsidian links. A block marker such as `1.` or `>` at the start needs none: plain
// text shows it as the note does, after the item's `[ ] `.
const MARKDOWN = /[\\`*_~=[\]!<&$%#@]|:\/\/|www\./i;

// Each block a title or heading could open at its start, with what to escape so that it reads as text.
// Ordered lists escape their delimiter, since a backslash before a digit is literal.
const BLOCK_STARTS: [RegExp, string][] = [
	[/^#{1,6}(?=[ \t]|$)/, '\\$&'],
	[/^>/, '\\>'],
	[/^([-*_])(?:[ \t]*\1){2,}[ \t]*$/, '\\$&'],
	[/^[-+*](?=[ \t]|$)/, '\\$&'],
	[/^(\d{1,9})([.)])(?=[ \t]|$)/, '$1\\$2'],
	[/^(?:`{3,}|~{3,})/, '\\$&'],
	[/^\[[^\]]*\]:/, '\\$&'],
];

// A title or heading without these renders as itself, so the view sets it as text and spares
// Obsidian's renderer, which is what costs most on a long list.
export function needsMarkdown(text: string): boolean {
	return MARKDOWN.test(text);
}

// Markdown that renders inline, as an item's title does in the note, where it follows the `[ ] ` in
// the item's paragraph: rendered alone, `1. call mom` would be a numbered list and `# of eggs` a
// heading. Leading whitespace goes, as a paragraph drops it, and four spaces would make code.
export function asInline(text: string): string {
	const trimmed = text.trimStart();
	for (const [start, escaped] of BLOCK_STARTS) {
		if (start.test(trimmed)) return trimmed.replace(start, escaped);
	}
	return trimmed;
}

/** What a paste puts in: the clipboard's HTML as Markdown, its plain text, or its pictures. */
export type PasteSource = 'html' | 'text' | 'pictures';

// Obsidian's editor marks the HTML it draws from copied Markdown with this comment.
const OBSIDIAN_HTML_MARK = '<!-- obsidian -->';

/**
 * Which of the clipboard's `types` a paste takes, given its `html`. Text wins over a picture, since
 * spreadsheets and word processors copy a picture of their text along with it; with no text, the
 * pictures. Pasted as Markdown, the text comes from the HTML, unless Markdown is what was copied.
 */
export function pasteSource(types: readonly string[], as: 'markdown' | 'plain', html: string): PasteSource {
	if (!types.includes('text/plain')) return 'pictures';
	const isCopiedMarkdown = types.includes('text/markdown') || html.includes(OBSIDIAN_HTML_MARK);
	return as === 'markdown' && types.includes('text/html') && !isCopiedMarkdown ? 'html' : 'text';
}

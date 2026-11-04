/** What a paste puts in: the clipboard's HTML as Markdown, its plain text, or its pictures. */
export type PasteSource = 'html' | 'text' | 'pictures';

/** A clipboard's types, with its plain text and HTML: empty when it holds none. */
export interface PastedData {
	types: readonly string[];
	text: string;
	html: string;
}

// Obsidian's editor marks the HTML it draws from copied Markdown with this comment.
const OBSIDIAN_HTML_MARK = '<!-- obsidian -->';

/** The text and HTML of a paste event's clipboard. */
export function pastedData(data: Pick<DataTransfer, 'types' | 'getData'>): PastedData {
	return { types: data.types, text: data.getData('text/plain'), html: data.getData('text/html') };
}

/**
 * Which part of the clipboard a paste takes. Text wins over a picture, since spreadsheets and word
 * processors copy a picture of their text along with it; with no text, the pictures. Pasted as
 * Markdown, the text comes from the HTML, unless Markdown is what was copied.
 */
export function pasteSource({ types, text, html }: PastedData, as: 'markdown' | 'plain'): PasteSource {
	if (text === '') return 'pictures';
	// Obsidian's copy adds text/markdown for a paste event, but navigator.clipboard.read() sees only the mark.
	const isCopiedMarkdown = types.includes('text/markdown') || html.includes(OBSIDIAN_HTML_MARK);
	return as === 'markdown' && html !== '' && !isCopiedMarkdown ? 'html' : 'text';
}

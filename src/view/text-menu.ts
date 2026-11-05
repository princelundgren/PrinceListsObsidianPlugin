import { EditorView } from '@codemirror/view';
import { htmlToMarkdown, Menu, Notice } from 'obsidian';
import { pasteSource } from '../core/clipboard';
import type { Format } from '../core/format';
import { fieldText, notesText, type EditableText } from './editable-text';
import type { PrinceListView } from './list-view';
import { insertNoteLink } from './note-link-modal';
import { NOTES_BLOCK_CLASS } from './notes-blocks';
import { NOTES_CODEMIRROR_CLASS } from './notes-editor';

interface FormatItem {
	format: Format;
	icon: string;
	label: string;
}

const FORMATS: readonly FormatItem[] = [
	{ format: 'bold', icon: 'bold', label: 'Bold' },
	{ format: 'italic', icon: 'italic', label: 'Italic' },
	{ format: 'strikethrough', icon: 'strikethrough', label: 'Strikethrough' },
	{ format: 'underline', icon: 'underline', label: 'Underline' },
	{ format: 'clearFormatting', icon: 'eraser', label: 'Clear formatting' },
];

const PARAGRAPHS: readonly FormatItem[] = [
	{ format: 'bulleted', icon: 'list', label: 'Bullet list' },
	{ format: 'numbered', icon: 'list-ordered', label: 'Numbered list' },
	{ format: 'checklist', icon: 'check-square', label: 'Task list' },
];

/**
 * For the view's contextmenu listener, on desktop only. Shows the text menu when the right-click was
 * in the card's title or in notes, a card's or the list's, and returns true; false anywhere else,
 * where a field keeps Obsidian's own menu, with its spelling suggestions.
 */
export function showTextMenu(view: PrinceListView, evt: MouseEvent, target: HTMLElement): boolean {
	const text = editableAt(view, target);
	if (!text) return false;
	evt.preventDefault();
	const menu = new Menu();
	addLinkItems(view, menu, text);
	menu.addSeparator();
	addFormatItems(menu, text, FORMATS);
	menu.addSeparator();
	if (text.takesLists) {
		addFormatItems(menu, text, PARAGRAPHS);
		menu.addSeparator();
	}
	addClipboardItems(menu, text);
	menu.showAtMouseEvent(evt);
	return true;
}

// A drawn block, such as a table, has no caret in it for the menu to act at.
function editableAt(view: PrinceListView, target: HTMLElement): EditableText | null {
	if (target.closest(`.${NOTES_BLOCK_CLASS}`)) return null;
	const notesEl = target.closest(`.${NOTES_CODEMIRROR_CLASS}`);
	const editor = notesEl?.instanceOf(HTMLElement) ? EditorView.findFromDOM(notesEl) : null;
	if (editor) return notesText(view, editor);
	const field = target.closest('textarea');
	return field && view.card?.el.contains(field) ? fieldText(field) : null;
}

// As in Obsidian's menu, neither link takes a selection over lines.
function addLinkItems(view: PrinceListView, menu: Menu, text: EditableText): void {
	const isDisabled = text.isReadOnly || text.selectedText().includes('\n');
	menu.addItem((entry) =>
		entry
			.setTitle('Add link')
			.setIcon('link')
			.setDisabled(isDisabled)
			.onClick(() => insertNoteLink(view, text)),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Add external link')
			.setIcon('external-link')
			.setDisabled(isDisabled)
			.onClick(() => runFocused(text, () => text.format('link'))),
	);
}

function addFormatItems(menu: Menu, text: EditableText, items: readonly FormatItem[]): void {
	for (const { format, icon, label } of items) {
		menu.addItem((entry) =>
			entry
				.setTitle(label)
				.setIcon(icon)
				.setDisabled(text.isReadOnly)
				.onClick(() => runFocused(text, () => text.format(format))),
		);
	}
}

function addClipboardItems(menu: Menu, text: EditableText): void {
	const selected = text.selectedText();
	menu.addItem((entry) =>
		entry
			.setTitle('Cut')
			.setIcon('scissors')
			.setDisabled(text.isReadOnly || selected === '')
			.onClick(() => runFocused(text, () => void cut(text, selected))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Copy')
			.setIcon('copy')
			.setDisabled(selected === '')
			.onClick(() => void writeClipboard(selected)),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Paste')
			.setIcon('clipboard-check')
			.setDisabled(text.isReadOnly)
			.onClick(() => runFocused(text, () => void paste(text, 'markdown'))),
	);
	menu.addItem((entry) =>
		entry
			.setTitle('Paste as plain text')
			.setIcon('clipboard-type')
			.setDisabled(text.isReadOnly)
			.onClick(() => runFocused(text, () => void paste(text, 'plain'))),
	);
}

// The menu may have taken focus, and the notes and the card's title act only while they have it.
function runFocused(text: EditableText, action: () => void): void {
	text.focus();
	action();
}

async function cut(text: EditableText, selected: string): Promise<void> {
	if (await writeClipboard(selected)) text.replaceSelection('');
}

async function writeClipboard(selected: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(selected);
		return true;
	} catch (error) {
		console.error(error);
		new Notice("Couldn't copy to the clipboard.");
		return false;
	}
}

async function paste(text: EditableText, as: 'markdown' | 'plain'): Promise<void> {
	try {
		const items = await navigator.clipboard.read();
		const data = { types: items.flatMap((item) => item.types), text: await textOf(items, 'text/plain'), html: await textOf(items, 'text/html') };
		const source = pasteSource(data, as);
		if (source === 'pictures') text.pastePictures(await picturesIn(items));
		else text.replaceSelection(source === 'html' ? htmlToMarkdown(data.html) : data.text);
	} catch (error) {
		console.error(error);
		new Notice("Couldn't paste from the clipboard.");
	}
}

async function textOf(items: ClipboardItem[], type: string): Promise<string> {
	const item = items.find((candidate) => candidate.types.includes(type));
	return item ? (await item.getType(type)).text() : '';
}

async function picturesIn(items: ClipboardItem[]): Promise<File[]> {
	const pictures: File[] = [];
	for (const item of items) {
		const type = item.types.find((candidate) => candidate.startsWith('image/'));
		if (!type) continue;
		const blob = await item.getType(type);
		// A pasted picture is named from its type and the time.
		pictures.push(new File([blob], '', { type }));
	}
	return pictures;
}

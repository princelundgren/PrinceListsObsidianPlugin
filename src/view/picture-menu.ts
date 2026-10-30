import type { EditorView } from '@codemirror/view';
import { getLinkpath, Menu, Notice, type TFile } from 'obsidian';
import { drawnBlocks } from '../core/drawn-blocks';
import { UnsafeEditError } from '../core/edit-check';
import type { PlannedLineEdit } from '../core/list-actions';
import { pictureLinks, planPictureRemove, type PictureLink, type PictureLinkAt } from '../core/picture-links';
import { contentStartLine } from '../obsidian/marker';
import type { Card } from './card';
import type { PrinceListView } from './list-view';
import { NOTES_BLOCK_CLASS } from './notes-blocks';
import { cardNotesSource, listNoteSource, type NotesSource } from './notes-source';
import { drawnPictureColumn, NOTES_PICTURE_CLASS } from './notes-widgets';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, writePlanned } from './write';

// Obsidian draws `![[…]]` and `![…](…)` pictures from the vault alike, with the link in `src`.
const PICTURE = '.internal-embed.image-embed';
const EMBEDDED_NOTE = '.markdown-embed';

/**
 * For the view's contextmenu listener, on desktop only. True when the right-click was on a picture
 * drawn in the open card's notes or the list note, which then shows the picture's menu, as Obsidian's
 * own image menu does (step two's spec, "Right-click menus"): Copy image and Remove image, Obsidian's
 * link menu, then Delete image. Remove and Delete show only while the picture's link is found.
 */
export function showPictureMenu(view: PrinceListView, evt: MouseEvent, target: HTMLElement): boolean {
	const found = cardPicture(view, target) ?? listNotePicture(view, target);
	if (!found) return false;
	const { linktext, removable } = found;
	evt.preventDefault();
	const file = view.app.metadataCache.getFirstLinkpathDest(getLinkpath(linktext), view.sourcePath);
	const menu = new Menu();
	if (file) menu.addItem((item) => item.setTitle('Copy image').setIcon('copy').setSection('image').onClick(() => copyPicture(view, file)));
	if (removable) menu.addItem((item) => item.setTitle('Remove image').setIcon('image-minus').setSection('image').onClick(() => removeLink(view, removable)));
	// It returns a boolean whose meaning isn't documented, so it isn't used.
	view.app.workspace.handleLinkContextMenu(menu, linktext, view.sourcePath);
	if (file && removable) {
		menu.addItem((item) =>
			item
				.setTitle('Delete image')
				.setIcon('trash-2')
				.setWarning(true)
				.setSection('danger')
				.onClick(() => void deletePicture(view, removable, file)),
		);
	}
	menu.showAtMouseEvent(evt);
	return true;
}

// A picture's link as the menu found it, with the list as it was then: a remove that waits for the
// menu, or for Obsidian's prompt, refuses once the list changed elsewhere or the card closed.
interface RemovableLink {
	link: PictureLinkAt;
	isListNote: boolean;
	card: Card | null;
	titleLine: number | null;
	seen: number;
}

interface MenuPicture {
	linktext: string;
	removable: RemovableLink | null;
}

function cardPicture(view: PrinceListView, target: HTMLElement): MenuPicture | null {
	const card = view.card;
	return card?.editor ? editorPicture(view, card.editor, cardNotesSource(view, card), card, target) : null;
}

function listNotePicture(view: PrinceListView, target: HTMLElement): MenuPicture | null {
	const editor = view.listNoteEditor;
	return editor ? editorPicture(view, editor, listNoteSource(view), null, target) : null;
}

// A picture a notes editor drew, or Obsidian's renderer drew in one of its blocks: in the open card's
// notes, `card`, or in the list note, with `card` null.
function editorPicture(view: PrinceListView, editor: EditorView, source: NotesSource, card: Card | null, target: HTMLElement): MenuPicture | null {
	const picture = target.closest<HTMLElement>(`${PICTURE}, .${NOTES_PICTURE_CLASS}`);
	// A picture in an embedded note belongs to that note.
	if (!picture || !editor.contentDOM.contains(picture) || picture.closest(EMBEDDED_NOTE)) return null;
	const link = editorLink(editor, picture);
	// Obsidian's renderer gives its pictures their link text in `src`; the editor's hold a resource URL.
	const linktext = link?.linkpath ?? (picture.matches(PICTURE) ? picture.getAttr('src') : null);
	if (!linktext) return null;
	const at = link ? fileLink(view, source, editor, link) : null;
	const titleLine = card ? view.selected : null;
	const removable = at && { link: at, isListNote: card === null, card, titleLine, seen: view.outsideChanges };
	return { linktext, removable: removable && canRemove(view, removable) ? removable : null };
}

// The picture's link in the editor's lines: from the editor's own drawing, or, in a drawn block, where
// the block's drawn pictures, in order, line up one to one with its picture links.
function editorLink(editor: EditorView, picture: HTMLElement): PictureLink | null {
	const { doc } = editor.state;
	const column = drawnPictureColumn(picture);
	if (column !== undefined) {
		const line = doc.lineAt(editor.posAtDOM(picture));
		const link = pictureLinks([line.text]).find((found) => found.from === column);
		return link ? { ...link, line: line.number - 1 } : null;
	}
	const blockEl = picture.closest(`.${NOTES_BLOCK_CLASS}`);
	const start = blockEl ? doc.lineAt(editor.posAtDOM(blockEl)).number - 1 : -1;
	const block = drawnBlocks(doc.toString()).find((drawn) => drawn.lines.start === start);
	if (!blockEl || !block) return null;
	const texts = Array.from({ length: block.lines.end - start }, (_, i) => doc.line(start + i + 1).text);
	const links = pictureLinks(texts);
	const pictures = Array.from(blockEl.querySelectorAll(PICTURE)).filter((el) => !el.closest(EMBEDDED_NOTE));
	const link = links[pictures.indexOf(picture)];
	if (links.length !== pictures.length || link?.linkpath !== picture.getAttr('src')) return null;
	return { ...link, line: start + link.line };
}

// The link's file line and columns, while the editor shows the notes as `source` reads them: the
// editor leaves off each line's indent, which moves the columns by its length.
function fileLink(view: PrinceListView, source: NotesSource, editor: EditorView, link: PictureLink): PictureLinkAt | null {
	const visitStart = source.visitStart();
	const notes = visitStart === null ? source.read() : { markdown: source.visitText(), start: visitStart };
	if (!notes || notes.markdown !== editor.state.doc.toString()) return null;
	const line = notes.start + link.line;
	const lineText = view.lines()[line]?.text;
	const shown = editor.state.doc.line(link.line + 1).text;
	// Less than zero where a tab ran past the notes' indent, and the editor shows the rest of it as spaces.
	const indent = lineText === undefined ? 0 : lineText.length - shown.length;
	if (lineText === undefined || lineText.slice(link.from + indent) !== shown.slice(link.from)) return null;
	return { line, lineText, from: link.from + indent, to: link.to + indent };
}

// The removal, planned on `text` for the item now at `titleLine`, which its own edits may have moved.
// null when the list changed elsewhere since the menu opened, and taking out the wrong link is worse
// than none.
function planRemove(view: PrinceListView, removable: RemovableLink, text: string, titleLine: number | null): PlannedLineEdit | null {
	const { link, isListNote, card, seen } = removable;
	if (view.outsideChanges !== seen) return null;
	if (isListNote) return planPictureRemove(text, contentStartLine(text), 'listNote', link);
	if (view.card !== card || titleLine === null || removable.titleLine === null) return null;
	const at = { ...link, line: link.line + titleLine - removable.titleLine };
	return planPictureRemove(text, contentStartLine(text), titleLine, at);
}

function canRemove(view: PrinceListView, removable: RemovableLink): boolean {
	try {
		return planRemove(view, removable, view.text, view.selected) !== null;
	} catch (error) {
		if (error instanceof UnsafeEditError) return false;
		throw error;
	}
}

// As a tick in the notes: it waits on the view's queue, and a card's line follows its item.
function removeLink(view: PrinceListView, removable: RemovableLink): void {
	const titleLine = removable.isListNote ? null : view.selected;
	enqueueAt(view, titleLine, async (pending) => {
		let planned = true;
		const written = await writePlanned(view, (text) => {
			const plan = planRemove(view, removable, text, pending?.line ?? null);
			planned = plan !== null;
			return plan;
		});
		if (!planned) new Notice(CHANGED_ELSEWHERE_NOTICE);
		else if (written) view.render();
	});
}

// Obsidian's own prompt moves the file to the trash once confirmed (observed, not documented). The file
// goes only while the link can go too, and the link after it, so a cancel leaves both.
async function deletePicture(view: PrinceListView, removable: RemovableLink, file: TFile): Promise<void> {
	if (!canRemove(view, removable)) {
		new Notice(CHANGED_ELSEWHERE_NOTICE);
		return;
	}
	if (await view.app.fileManager.promptForDeletion(file)) removeLink(view, removable);
}

// The clipboard takes pictures as PNG only, so any other format is drawn into one first.
function copyPicture(view: PrinceListView, file: TFile): void {
	const png = view.app.vault.readBinary(file).then((data) => asPng(new Blob([data], { type: mimeType(file.extension) })));
	navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]).catch((error: unknown) => {
		console.error(error);
		new Notice("Couldn't copy the image.");
	});
}

async function asPng(blob: Blob): Promise<Blob> {
	if (blob.type === 'image/png') return blob;
	const url = URL.createObjectURL(blob);
	try {
		const img = createEl('img', { attr: { src: url } });
		await img.decode();
		const canvas = createEl('canvas', { attr: { width: img.naturalWidth, height: img.naturalHeight } });
		canvas.getContext('2d')?.drawImage(img, 0, 0);
		return await new Promise((resolve, reject) =>
			canvas.toBlob((png) => (png ? resolve(png) : reject(new Error(`Couldn't draw ${blob.type} as PNG`))), 'image/png'),
		);
	} finally {
		URL.revokeObjectURL(url);
	}
}

function mimeType(extension: string): string {
	const type = extension.toLowerCase();
	if (type === 'jpg') return 'image/jpeg';
	if (type === 'svg') return 'image/svg+xml';
	return `image/${type}`;
}

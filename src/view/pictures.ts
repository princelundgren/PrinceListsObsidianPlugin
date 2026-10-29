import { EditorView } from '@codemirror/view';
import { Notice } from 'obsidian';
import { pictureName } from '../core/picture';
import type { Card } from './card';
import { targetOf } from './dom';
import type { PrinceListView } from './list-view';
import { appendNotesBlock, NOTES_CODEMIRROR_CLASS } from './notes-editor';

const REFUSED_NOTICE = "Obsidian can't show that kind of picture, so it wasn't added.";
const FAILED_NOTICE = "Couldn't add the picture.";
const OUTSIDE_VAULT_NOTICE = "Pictures can't be added to a list outside the vault.";

export function registerPictureEvents(view: PrinceListView): void {
	const { contentEl } = view;
	// A picture dragged from a rendered note starts a drag here; a file from another app doesn't.
	let dragFromPage = false;
	view.registerDomEvent(contentEl.doc, 'dragstart', () => (dragFromPage = true), { capture: true });
	view.registerDomEvent(contentEl.doc, 'dragend', () => (dragFromPage = false), { capture: true });
	// A redraw can detach a drag's source so its dragend never comes; every drag in the page starts here.
	view.registerDomEvent(contentEl.doc, 'pointerdown', () => (dragFromPage = false), { capture: true });
	view.registerDomEvent(contentEl, 'paste', (evt) => onPaste(view, evt));
	view.registerDomEvent(contentEl, 'dragover', (evt) => {
		if (!dragFromPage) onDragOver(view, evt);
	});
	view.registerDomEvent(contentEl, 'drop', (evt) => {
		if (!dragFromPage) onDrop(view, evt);
	});
	// After the view's own drop listener, which needs the flag.
	view.registerDomEvent(contentEl.doc, 'drop', () => (dragFromPage = false));
	// A picture in the notes loads after their editor measured it, and `load` doesn't bubble.
	view.registerDomEvent(contentEl, 'load', () => measureNotesEditors(contentEl), { capture: true });
}

function measureNotesEditors(contentEl: HTMLElement): void {
	for (const editorEl of contentEl.findAll(`.${NOTES_CODEMIRROR_CLASS}`)) EditorView.findFromDOM(editorEl)?.requestMeasure();
}

// A paste goes where focus is, so it is in the notes while their editor has it.
function onPaste(view: PrinceListView, evt: ClipboardEvent): void {
	const card = view.card;
	if (!card || card.lostAt !== null || !card.editor?.hasFocus) return;
	// Spreadsheets and word processors copy a picture of their text along with it; the text wins.
	if (evt.clipboardData?.getData('text/plain')) return;
	const pictures = Array.from(evt.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
	if (pictures.length === 0) return;
	evt.preventDefault();
	void addPictures(view, card, pictures, true);
}

function onDragOver(view: PrinceListView, evt: DragEvent): void {
	if (!inOpenCard(view, evt) || !mayHoldPicture(evt)) return;
	evt.preventDefault();
	// Obsidian's own listener would make it a move, which a photo from another app refuses.
	if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'copy';
	evt.stopPropagation();
}

function onDrop(view: PrinceListView, evt: DragEvent): void {
	const card = view.card;
	if (!card || !inOpenCard(view, evt) || !mayHoldPicture(evt)) return;
	evt.preventDefault();
	evt.stopPropagation();
	void addPictures(view, card, Array.from(evt.dataTransfer?.files ?? []), false);
}

function inOpenCard(view: PrinceListView, evt: DragEvent): boolean {
	const target = targetOf(evt);
	return !!target && view.card?.lostAt === null && view.card.el.contains(target);
}

// iOS hides a drag's items until the drop, leaving only the 'Files' type; each file is checked then.
function mayHoldPicture(evt: DragEvent): boolean {
	const items = Array.from(evt.dataTransfer?.items ?? []);
	if (items.length === 0) return evt.dataTransfer?.types.includes('Files') ?? false;
	return items.some((item) => item.kind === 'file' && item.type.startsWith('image/'));
}

// The pictures go in a block of their own at the end of the notes.
async function addPictures(view: PrinceListView, card: Card, files: File[], pasted: boolean): Promise<void> {
	const list = view.file;
	if (!list) return;
	// A note outside the vault has no parent (observed in 1.14.4), and its picture links can't resolve.
	if (!list.parent) {
		new Notice(OUTSIDE_VAULT_NOTICE);
		return;
	}
	const links: string[] = [];
	const paths: string[] = [];
	let refused = false;
	let failed = false;
	for (const picture of files) {
		const name = pictureName(picture, pasted, new Date());
		if (name === null) {
			if (!refused) new Notice(REFUSED_NOTICE);
			refused = true;
			continue;
		}
		try {
			const path = await view.app.fileManager.getAvailablePathForAttachment(name, list.path);
			const created = await view.app.vault.createBinary(path, await picture.arrayBuffer());
			links.push('!' + view.app.fileManager.generateMarkdownLink(created, list.path));
			paths.push(created.path);
		} catch (error) {
			console.error(error);
			if (!failed) new Notice(FAILED_NOTICE);
			failed = true;
		}
	}
	if (links.length === 0) return;
	if (view.card !== card || card.lostAt !== null) {
		new Notice(`The card closed before the picture was added. It's saved as ${paths.join(', ')}.`);
		return;
	}
	if (!card.editor || !appendNotesBlock(card.editor, links.join('\n'))) new Notice(`Couldn't add the picture to the notes. It's saved as ${paths.join(', ')}.`);
}

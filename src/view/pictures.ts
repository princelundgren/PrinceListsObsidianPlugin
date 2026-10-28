import { Notice } from 'obsidian';
import { pictureName } from '../core/picture';
import { CARD_NOTES_CLASS, NOTES_EDITOR_CLASS, type Card } from './card';
import { targetOf } from './dom';
import { changeField } from './field-undo';
import type { PrinceListView } from './list-view';
import { openNewPiece, pieceInput } from './note-piece-field';
import { cardNotesHost } from './notes-host';

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
}

// A ClipboardEvent has no targetNode, so the field is found among the view's own textareas.
function onPaste(view: PrinceListView, evt: ClipboardEvent): void {
	const card = view.card;
	const editor = Array.from(view.contentEl.querySelectorAll('textarea')).find((field) => field === evt.target);
	if (!card || card.lostAt !== null || !editor?.hasClass(NOTES_EDITOR_CLASS) || !card.el.contains(editor)) return;
	// Spreadsheets and word processors copy a picture of their text along with it; the text wins.
	if (evt.clipboardData?.getData('text/plain')) return;
	const pictures = Array.from(evt.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
	if (pictures.length === 0) return;
	evt.preventDefault();
	void addPictures(view, card, pictures, { pasted: true, into: editor });
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
	const field = targetOf(evt)?.closest('textarea');
	const into = field?.hasClass(NOTES_EDITOR_CLASS) ? field : null;
	void addPictures(view, card, Array.from(evt.dataTransfer?.files ?? []), { pasted: false, into });
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

// `into`, the open piece's field a picture was pasted or dropped in, takes it at its caret, while it is
// still open. Otherwise it goes in a new piece at the end.
async function addPictures(
	view: PrinceListView,
	card: Card,
	files: File[],
	{ pasted, into }: { pasted: boolean; into: HTMLTextAreaElement | null },
): Promise<void> {
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
	insertLinks(view, card, links.join('\n'), into);
}

function insertLinks(view: PrinceListView, card: Card, text: string, into: HTMLTextAreaElement | null): void {
	const area = card.el.querySelector<HTMLElement>(`.${CARD_NOTES_CLASS}`);
	if (!area) return;
	if (into?.isConnected && !into.readOnly) {
		const end = into.selectionEnd;
		changeField(into, () => into.setRangeText(text, end, end, 'end'));
		pieceInput(view, into);
		return;
	}
	// Blurred, an open field closes and its piece is drawn, before the new piece opens.
	area.querySelector('textarea')?.blur();
	const field = openNewPiece(view, cardNotesHost(view, card, area));
	if (!field) return;
	changeField(field, () => (field.value = text));
	pieceInput(view, field);
}

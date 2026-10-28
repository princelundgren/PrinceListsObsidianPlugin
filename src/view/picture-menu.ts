import { getLinkpath, Menu, Notice, type TFile } from 'obsidian';
import { UnsafeEditError } from '../core/edit-check';
import type { PlannedLineEdit } from '../core/list-actions';
import { pictureLinks, planPictureRemove, type PictureLinkAt } from '../core/picture-links';
import { contentStartLine } from '../obsidian/marker';
import type { Card } from './card';
import type { PrinceListView } from './list-view';
import { notesHostOf, type NotesHost } from './notes-host';
import { placeAt } from './note-pieces';
import { drawnPieces, NOTE_PIECE_CLASS } from './note-piece-state';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, writePlanned } from './write';

// Obsidian draws `![[…]]` and `![…](…)` pictures from the vault alike, with the link in `src`.
const PICTURE = '.internal-embed.image-embed';
const EMBEDDED_NOTE = '.markdown-embed';

/**
 * For the view's contextmenu listener, on desktop only. True when the right-click was on a picture
 * drawn in the open card's notes or the list note, which then shows the picture's menu, as Obsidian's
 * own image menu does (step two's spec, "Right-click menus"): Copy image and Remove image, Obsidian's
 * link menu, then Delete image. Remove and Delete show only while the picture can be lined up with its link.
 */
export function showPictureMenu(view: PrinceListView, evt: MouseEvent, target: HTMLElement): boolean {
	const picture = target.closest<HTMLElement>(PICTURE);
	const host = picture ? notesHostOf(view, picture) : null;
	const linktext = picture?.getAttr('src');
	// A picture in an embedded note belongs to that note.
	if (!picture || !host || !linktext || picture.closest(EMBEDDED_NOTE)) return false;
	evt.preventDefault();
	const file = view.app.metadataCache.getFirstLinkpathDest(getLinkpath(linktext), view.sourcePath);
	const removable = removableLink(view, host, picture, linktext);
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

// The picture's link when it can be taken out now: the drawn pictures of its piece, in order, line
// up one to one with the piece's picture links, and the edit is safe.
function removableLink(view: PrinceListView, host: NotesHost, picture: HTMLElement, linktext: string): RemovableLink | null {
	const found = host.notes();
	const pieceEl = picture.closest<HTMLElement>(`.${NOTE_PIECE_CLASS}`);
	const drawn = pieceEl ? drawnPieces.get(pieceEl) : undefined;
	if (!found || !pieceEl || !drawn || placeAt(picture, found.notes) === 'stale') return null;
	const pictures = Array.from(pieceEl.querySelectorAll(PICTURE)).filter((el) => !el.closest(EMBEDDED_NOTE));
	const texts = view.lines().slice(drawn.range.start, drawn.range.end).map((line) => line.text);
	const links = pictureLinks(texts);
	const link = links[pictures.indexOf(picture)];
	if (links.length !== pictures.length || link?.linkpath !== linktext) return null;
	const removable = {
		link: { line: drawn.range.start + link.line, lineText: texts[link.line] ?? '', from: link.from, to: link.to },
		isListNote: host.kind === 'listNote',
		card: host.kind === 'card' ? view.card : null,
		titleLine: host.kind === 'card' ? view.selected : null,
		seen: view.outsideChanges,
	};
	return canRemove(view, removable) ? removable : null;
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

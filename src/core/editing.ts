import { UnsafeEditError } from './edit-check';
import { mapPieceRange } from './edit-piece';
import { followLine, followRange, ownEdit, type LineRange, type OwnEdit, type RunEdit } from './follow';
import { mapLine } from './guard';
import { EditHistory } from './history';
import { parseItemLine } from './item-line';
import { joinLines, splitLines, type Line } from './lines';
import type { NotesChange } from './notes-lines';
import { fitsInVisit, openVisit, saveInVisit, visitText, type NotesVisit } from './notes-visit';
import { itemAt, parseList, type ItemBlock, type ListModel } from './parse';
import { startTitleField, syncTitleField, typeTitle, type TitleField } from './title-field';
import { splitStar } from './star';

/**
 * What a keystroke did. A refused one wrote nothing, and its change never lands in the editor;
 * `firstRefusal` is true once per session, for the one notice. A lost one wrote nothing because its
 * item or session is gone.
 */
export type Typed = { edit: OwnEdit } | { refused: true; firstRefusal: boolean } | { lost: true };
/** As Typed, with the whole list note as saved, which its warnings check. */
export type TypedListNote = { edit: OwnEdit; note: string } | Exclude<Typed, { edit: OwnEdit }>;

/** A line that follows the view's own edits and outside changes. null once it is gone. */
export interface TrackedLine {
	line: number | null;
}

// The view's text and the line-based state that edits it: the open card's item (`selected`), the
// title's typing session, the notes' visit and lines waiting for a write. Every edit that moves
// lines comes through here, so the state follows it (spec, "Saving and outside changes").
export class ListEditing {
	text = '';
	/** The titleLine of the item whose card is open, or null. */
	selected: number | null = null;
	readonly history = new EditHistory();
	private readonly tracked = new Set<TrackedLine>();
	// `field` changes with every keystroke; the object around it is the typing session.
	private title: { field: TitleField } | null = null;
	private visit: NotesVisit | null = null;

	constructor(private readonly contentStartOf: (text: string) => number) {}

	// For a different file: nothing tracked in the old one may act on the new one.
	reset(): void {
		this.selected = null;
		for (const tracked of this.tracked) tracked.line = null;
		this.tracked.clear();
		this.endCard();
		this.visit = null;
		this.history.clear();
	}

	open(titleLine: number): void {
		this.endCard();
		this.selected = titleLine;
	}

	close(): void {
		this.endCard();
		this.selected = null;
	}

	track(line: number): TrackedLine {
		const tracked = { line };
		this.tracked.add(tracked);
		return tracked;
	}

	untrack(tracked: TrackedLine): void {
		this.tracked.delete(tracked);
	}

	selectedTitle(): string {
		const line = this.selected === null ? undefined : splitLines(this.text)[this.selected];
		return splitStar((line && parseItemLine(line.text)?.title) ?? '').plain;
	}

	focusTitle(): void {
		const line = this.selected === null ? undefined : splitLines(this.text)[this.selected];
		this.title = line ? { field: startTitleField(line.text) } : null;
	}

	blurTitle(): void {
		this.title = null;
	}

	typeTitle(typed: string): Typed {
		const found = this.selectedItem();
		const session = this.title;
		if (!found || !session) return { lost: true };
		const result = typeTitle(found.lines, found.item, session.field, typed);
		session.field = result.field;
		return { edit: this.apply(joinLines(result.lines), found.item.titleLine, 'change', session) };
	}

	closeNotes(): void {
		if (this.visit?.notes === 'item') this.visit = null;
	}

	/** The lines the visit to the card's notes holds, while one is open. */
	notesPieceRange(): LineRange | null {
		return this.visit?.notes === 'item' ? this.visit.piece.range : null;
	}

	closeListNote(): void {
		if (this.visit?.notes === 'listNote') this.visit = null;
	}

	/** The lines the visit to the list note holds, while one is open. */
	listNoteRange(): LineRange | null {
		return this.visit?.notes === 'listNote' ? this.visit.piece.range : null;
	}

	/**
	 * Starts a visit to the open card's notes or to the list note, ending any other visit. It
	 * returns the notes as parsed, without their indent, or null when the card's item is gone.
	 */
	openNotes(notes: NotesVisit['notes']): string | null {
		this.visit = null;
		const found = notes === 'item' ? this.selectedItem() : { ...this.parse(), item: null };
		if (!found) return null;
		const visit = openVisit(found.lines, found.model, found.item);
		this.visit = visit;
		return visitText(found.lines, visit);
	}

	/** The visit's own lines as its editor holds them, or null once an outside change took them. */
	visitText(): string | null {
		return this.visit ? visitText(splitLines(this.text), this.visit) : null;
	}

	/**
	 * Whether the visit's notes can take `change`. It changes nothing. Without a visit, a save says so.
	 * Throws when `change` reaches past the lines the visit holds: the editor is out of step with them.
	 */
	notesChangeFits(change: NotesChange): boolean {
		const found = this.visited();
		return !found || fitsInVisit(found.lines, found.model, found.item, found.visit, change);
	}

	/** Saves `change` to the card's notes. All of a visit's saves are one step of the list's undo. */
	saveNotes(change: NotesChange): Typed {
		const typed = this.saveVisit('item', change);
		return 'edit' in typed ? { edit: typed.edit } : typed;
	}

	/** As saveNotes, for the list note. */
	saveListNote(change: NotesChange): TypedListNote {
		return this.saveVisit('listNote', change);
	}

	// One of the view's own one-off writes landed, such as a tick or a removal.
	applyOwn(next: string, edit: OwnEdit): void {
		this.history.wrote(this.text, next, edit);
		this.follow(next, edit);
	}

	// Lines are mapped by text, and a typing session keeps its text (spec, "Saving and outside
	// changes"). A visit whose own lines changed is lost.
	outsideChange(next: string): { lostSelected: boolean } {
		const oldLines = splitLines(this.text);
		const newLines = splitLines(next);
		this.text = next;
		this.history.clear();
		const map = (line: number | null) => (line === null ? null : mapLine(oldLines, newLines, line));
		for (const tracked of this.tracked) tracked.line = map(tracked.line);
		const hadSelected = this.selected !== null;
		this.selected = map(this.selected);
		this.afterMove(newLines);
		const visit = this.visit;
		if (visit) {
			const { range } = visit.piece;
			const mapped = mapPieceRange(oldLines, newLines, range);
			if (!mapped) this.visit = null;
			else visit.piece.range = mapped;
			if (mapped && visit.notes === 'listNote') visit.piece.blankAfter &&= mapLine(oldLines, newLines, range.end) === mapped.end;
		}
		return { lostSelected: hadSelected && this.selected === null };
	}

	private saveVisit(notes: NotesVisit['notes'], change: NotesChange): TypedListNote {
		const found = this.visited(notes);
		if (!found) return { lost: true };
		const { lines, model, item, visit } = found;
		return this.refusable(visit, () => {
			const save = saveInVisit(lines, model, item, visit, change);
			visit.piece = save.span;
			return { edit: this.apply(joinLines(save.lines), save.start, save.kind, visit), note: save.note ?? '' };
		});
	}

	private visited(notes?: NotesVisit['notes']) {
		const visit = this.visit;
		if (!visit || (notes && visit.notes !== notes)) return null;
		const found = visit.notes === 'item' ? this.selectedItem() : { ...this.parse(), item: null };
		return found && { ...found, visit };
	}

	private refusable<T extends Typed>(session: { refused: boolean }, save: () => T): T | Exclude<Typed, { edit: OwnEdit }> {
		try {
			return save();
		} catch (error) {
			if (!(error instanceof UnsafeEditError)) throw error;
			const firstRefusal = !session.refused;
			session.refused = true;
			return { refused: true, firstRefusal };
		}
	}

	private apply(next: string, start: number, kind: RunEdit['kind'], session: object): OwnEdit {
		const edit = ownEdit(start, this.text, next, kind);
		this.history.typed(session, this.text, next, edit);
		this.follow(next, edit, session);
		return edit;
	}

	// A visit's own saves set its range instead, so `from`, the keystroke's session, skips it.
	private follow(next: string, edit: OwnEdit, from?: object): void {
		this.text = next;
		for (const tracked of this.tracked) tracked.line = tracked.line === null ? null : followLine(tracked.line, edit);
		const selected = this.selected;
		this.selected = selected === null ? null : followLine(selected, edit);
		this.afterMove(splitLines(next), edit.kind !== 'move' && edit.start === selected ? edit.retitle : undefined);
		const visit = this.visit;
		if (visit && visit !== from) {
			const range = followRange(visit.piece.range, edit);
			if (range) visit.piece.range = range;
			else this.visit = null;
		}
	}

	// A card whose item is gone has no sessions. In one whose line something else changed, the title's
	// saved line follows the change (syncTitleField).
	private afterMove(lines: readonly Line[], retitle?: (line: string) => string): void {
		const line = this.selected === null ? undefined : lines[this.selected];
		if (!line) {
			this.selected = null;
			this.endCard();
		} else if (this.title) {
			this.title.field = syncTitleField(this.title.field, line.text, retitle);
		}
	}

	private endCard(): void {
		this.title = null;
		this.closeNotes();
	}

	private parse(): { lines: Line[]; model: ListModel } {
		const lines = splitLines(this.text);
		return { lines, model: parseList(lines, this.contentStartOf(this.text)) };
	}

	private selectedItem(): { lines: Line[]; model: ListModel; item: ItemBlock } | null {
		if (this.selected === null) return null;
		const { lines, model } = this.parse();
		const item = itemAt(model, this.selected);
		return item ? { lines, model, item } : null;
	}
}

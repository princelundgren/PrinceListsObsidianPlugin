import { UnsafeEditError } from './edit-check';
import { mapPieceRange, setNotesPiece, type PieceSession } from './edit-piece';
import { getItemNotes, notesStartLine } from './edit-items';
import { getListNote, listNoteWithPiece, setListNotePiece, type ListNotePiece } from './edit-list-note';
import { followLine, followRange, ownEdit, type LineRange, type OwnEdit, type RunEdit } from './follow';
import { mapLine } from './guard';
import { EditHistory } from './history';
import { parseItemLine } from './item-line';
import { joinLines, splitLines, type Line } from './lines';
import { outdentMarker, pieceText } from './note-pieces';
import { itemAt, parseList, type ItemBlock, type ListModel } from './parse';
import { startTitleField, syncTitleField, typeTitle, type TitleField } from './title-field';
import { splitStar } from './star';

/**
 * What a keystroke did. A refused one wrote nothing, and the field keeps its text for the next
 * keystroke to try again; `firstRefusal` is true once per session, for the one notice. A lost one
 * wrote nothing because its item or session is gone.
 */
export type Typed = { edit: OwnEdit } | { refused: true; firstRefusal: boolean } | { lost: true };

/** A line that follows the view's own edits and outside changes. null once it is gone. */
export interface TrackedLine {
	line: number | null;
}

// The one open piece of notes, in the open card's item or in the list note.
type OpenPiece = { notes: 'item'; piece: PieceSession; refused: boolean } | { notes: 'listNote'; piece: ListNotePiece; refused: boolean };

// The view's text and the line-based state that edits it: the open card's item (`selected`), the
// three typing sessions and lines waiting for a write. Every edit that moves lines comes through
// here, so the state follows it (spec, "Saving and outside changes").
export class ListEditing {
	text = '';
	/** The titleLine of the item whose card is open, or null. */
	selected: number | null = null;
	readonly history = new EditHistory();
	private readonly tracked = new Set<TrackedLine>();
	// `field` changes with every keystroke; the object around it is the typing session.
	private title: { field: TitleField } | null = null;
	private piece: OpenPiece | null = null;

	constructor(private readonly contentStartOf: (text: string) => number) {}

	// For a different file: nothing tracked in the old one may act on the new one.
	reset(): void {
		this.selected = null;
		for (const tracked of this.tracked) tracked.line = null;
		this.tracked.clear();
		this.endCard();
		this.piece = null;
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
		if (this.piece?.notes === 'item') this.piece = null;
	}

	/** The lines the open piece of the notes writes, while one is open. */
	notesPieceRange(): LineRange | null {
		return this.piece?.notes === 'item' ? this.piece.piece.range : null;
	}

	// An empty range is a new piece, at the notes' indent, or a new item from Enter, at `indent` or
	// the indent of the piece still open, which it follows.
	openNotesPiece(range: LineRange, isNew: boolean, indent?: string): string | null {
		const found = this.selectedItem();
		if (!found) {
			this.closeNotes();
			return null;
		}
		const opened = this.openedText(range, isNew, found.item.notesIndent, indent);
		this.piece = { notes: 'item', piece: { range, indent: opened.indent, separator: isNew }, refused: false };
		return opened.text;
	}

	/** The marker that moves the open piece, an item whose field holds `text`, one level out. */
	notesPieceOutdent(text: string): string | null {
		const found = this.selectedItem();
		if (!found || this.piece?.notes !== 'item') return null;
		const { lines, item } = found;
		return outdentIn(lines, getItemNotes(lines, item), notesStartLine(lines, item), item.endLine, this.piece.piece, text);
	}

	typeNotesPiece(markdown: string): Typed {
		const found = this.selectedItem();
		const session = this.piece;
		if (!found || session?.notes !== 'item') return { lost: true };
		const { lines, model, item } = found;
		return this.refusable(session, () => {
			const result = setNotesPiece(lines, model, item, session.piece, markdown);
			session.piece = result.piece;
			return { edit: this.apply(joinLines(result.lines), item.titleLine, 'change', session) };
		});
	}

	// An empty range is a new piece, or a new item from Enter, as in openNotesPiece.
	openListNote(range: LineRange, isNew: boolean, indent?: string): string {
		const opened = this.openedText(range, isNew, '', indent);
		this.piece = { notes: 'listNote', piece: { range, indent: opened.indent, separator: isNew, blankAfter: false }, refused: false };
		return opened.text;
	}

	closeListNote(): void {
		if (this.piece?.notes === 'listNote') this.piece = null;
	}

	/** The lines the list note's open piece writes, while one is open. */
	listNoteRange(): LineRange | null {
		return this.piece?.notes === 'listNote' ? this.piece.piece.range : null;
	}

	/** As notesPieceOutdent, for the list note's open piece. */
	listNoteOutdent(text: string): string | null {
		if (this.piece?.notes !== 'listNote') return null;
		const { lines, model } = this.parse();
		const { start, end } = model.listNote;
		return outdentIn(lines, getListNote(lines, model), start, end, this.piece.piece, text);
	}

	/** The whole list note as it would read with `markdown` saved in the open piece. */
	listNoteAsTyped(markdown: string): string | null {
		if (this.piece?.notes !== 'listNote') return null;
		const { lines, model } = this.parse();
		return listNoteWithPiece(lines, model, this.piece.piece, markdown);
	}

	typeListNote(markdown: string): Typed {
		const session = this.piece;
		if (session?.notes !== 'listNote') return { lost: true };
		const { lines, model } = this.parse();
		return this.refusable(session, () => {
			const { range, separator } = session.piece;
			const result = setListNotePiece(lines, model, session.piece, markdown);
			session.piece = result.piece;
			// A new piece's save starts at the unchanged line above it; with no line above, it goes in
			// before whatever is at its start.
			const isInsert = range.start === range.end && !separator;
			const start = separator ? range.start - 1 : range.start;
			return { edit: this.apply(joinLines(result.lines), start, isInsert ? 'insert' : 'change', session) };
		});
	}

	// One of the view's own one-off writes landed, such as a tick or a removal.
	applyOwn(next: string, edit: OwnEdit): void {
		this.history.wrote(this.text, next, edit);
		this.follow(next, edit);
	}

	// Lines are mapped by text, and a typing session keeps its text (spec, "Saving and outside
	// changes"). A piece of notes whose own lines changed is lost.
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
		const session = this.piece;
		if (session) {
			const { range } = session.piece;
			const mapped = mapPieceRange(oldLines, newLines, range);
			if (!mapped) this.piece = null;
			else session.piece.range = mapped;
			if (mapped && session.notes === 'listNote') session.piece.blankAfter &&= mapLine(oldLines, newLines, range.end) === mapped.end;
		}
		return { lostSelected: hadSelected && this.selected === null };
	}

	private refusable(session: { refused: boolean }, save: () => Typed): Typed {
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

	// A piece's own saves set its range instead, so `from`, the keystroke's session, skips it.
	private follow(next: string, edit: OwnEdit, from?: object): void {
		this.text = next;
		for (const tracked of this.tracked) tracked.line = tracked.line === null ? null : followLine(tracked.line, edit);
		const selected = this.selected;
		this.selected = selected === null ? null : followLine(selected, edit);
		this.afterMove(splitLines(next), edit.kind !== 'move' && edit.start === selected ? edit.retitle : undefined);
		const session = this.piece;
		if (session && session !== from) {
			const range = followRange(session.piece.range, edit);
			if (range) session.piece.range = range;
			else this.piece = null;
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

	// An empty range opens no text, at `indent`, the notes' indent when new, or the open piece's,
	// which a new item from Enter follows.
	private openedText(range: LineRange, isNew: boolean, notesIndent: string, indent?: string): { text: string; indent: string } {
		if (range.start < range.end) return pieceText(this.text, range);
		return { text: '', indent: indent ?? (isNew ? notesIndent : (this.piece?.piece.indent ?? notesIndent)) };
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

// The marker that moves `piece`, an item whose field holds `text`, one level out, in notes that start
// at file line `start` and end before `end`.
function outdentIn(lines: readonly Line[], notes: string, start: number, end: number, piece: PieceSession, text: string): string | null {
	const fileLines = lines.slice(start, end).map((line) => line.text);
	return outdentMarker(notes, fileLines, { start: piece.range.start - start, end: piece.range.end - start }, piece.indent + text);
}

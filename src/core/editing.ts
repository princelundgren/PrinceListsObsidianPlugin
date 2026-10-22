import { UnsafeEditError } from './edit-check';
import { getItemNotes, setItemNotes } from './edit-items';
import { isBlankAt } from './edit-lines';
import { getListNote, setListNote } from './edit-list-note';
import { followLine, followRange, mapRange, ownEdit, type LineRange, type OwnEdit, type RunEdit } from './follow';
import { mapLine } from './guard';
import { parseItemLine } from './item-line';
import { joinLines, splitLines, type Line } from './lines';
import { itemAt, parseList, type ItemBlock, type ListModel } from './parse';
import { startTitleField, syncTitleField, typeTitle, type TitleField } from './title-field';

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

// The view's text and the line-based state that edits it: the open card's item (`selected`), the
// three typing sessions and lines waiting for a write. Every edit that moves lines comes through
// here, so the state follows it (spec, "Saving and outside changes").
export class ListEditing {
	text = '';
	/** The titleLine of the item whose card is open, or null. */
	selected: number | null = null;
	private readonly tracked = new Set<TrackedLine>();
	private title: TitleField | null = null;
	private notes: { indent: string; refused: boolean } | null = null;
	// `separator`: the blank line this session's last save wrote right under the note, or null.
	private note: { range: LineRange; separator: number | null; refused: boolean } | null = null;

	constructor(private readonly contentStartOf: (text: string) => number) {}

	// For a different file: nothing tracked in the old one may act on the new one.
	reset(): void {
		this.selected = null;
		for (const tracked of this.tracked) tracked.line = null;
		this.tracked.clear();
		this.endCard();
		this.note = null;
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
		return (line && parseItemLine(line.text)?.title) ?? '';
	}

	selectedNotes(): string {
		const found = this.selectedItem();
		return found ? getItemNotes(found.lines, found.item) : '';
	}

	focusTitle(): void {
		const line = this.selected === null ? undefined : splitLines(this.text)[this.selected];
		this.title = line ? startTitleField(line.text) : null;
	}

	blurTitle(): void {
		this.title = null;
	}

	typeTitle(typed: string): Typed {
		const found = this.selectedItem();
		if (!found || !this.title) return { lost: true };
		const result = typeTitle(found.lines, found.item, this.title, typed);
		this.title = result.field;
		return { edit: this.apply(joinLines(result.lines), found.item.titleLine, 'change') };
	}

	// The notes the textarea opens with. The indent is the one every save uses until it closes, since
	// re-parsed after a save it would take in spaces typed at the start of the notes.
	openNotes(): string | null {
		const found = this.selectedItem();
		if (!found) return null;
		this.notes = { indent: found.item.notesIndent, refused: false };
		return getItemNotes(found.lines, found.item);
	}

	closeNotes(): void {
		this.notes = null;
	}

	typeNotes(markdown: string): Typed {
		const found = this.selectedItem();
		const session = this.notes;
		if (!found || !session) return { lost: true };
		const { lines, model, item } = found;
		return this.refusable(session, () => {
			const next = joinLines(setItemNotes(lines, model, item, markdown, session.indent));
			return { edit: this.apply(next, item.titleLine, 'change') };
		});
	}

	// Seeds the range each save replaces; see setListNote for why it isn't re-read from the file.
	openListNote(): string {
		const { lines, model } = this.parse();
		this.note = { range: model.listNote, separator: null, refused: false };
		return getListNote(lines, model);
	}

	closeListNote(): void {
		this.note = null;
	}

	/** The lines the list note's field writes, while it is open. */
	listNoteRange(): LineRange | null {
		return this.note?.range ?? null;
	}

	typeListNote(markdown: string): Typed {
		const session = this.note;
		if (!session) return { lost: true };
		const { lines, model } = this.parse();
		return this.refusable(session, () => {
			const { range, separator } = session;
			// The blank line the last save wrote under the note is replaced with the note, so a note
			// erased again leaves none behind; but only while it is still blank and right under the
			// note, since a line another device added there must stay.
			const owned = separator === range.end && isBlankAt(lines, separator);
			const replaced = owned ? { start: range.start, end: range.end + 1 } : range;
			const result = setListNote(lines, model, replaced, markdown);
			// setListNote returns the note's own lines; a line count that grew past them is the blank
			// line it wrote under the note.
			const written = result.note.end - result.note.start;
			const wroteSeparator = result.lines.length - lines.length > written - (replaced.end - replaced.start);
			session.range = result.note;
			session.separator = wroteSeparator ? result.note.end : null;
			// With no note yet, the note goes in before whatever is at its start.
			const kind = replaced.start === replaced.end ? 'insert' : 'change';
			return { edit: this.apply(joinLines(result.lines), replaced.start, kind, session) };
		});
	}

	// One of the view's own one-off writes landed, such as a tick or a removal.
	applyOwn(next: string, edit: OwnEdit): void {
		this.follow(next, edit);
	}

	// Lines are mapped by text, and a typing session keeps its text (spec, "Saving and outside
	// changes"). The list note's field reads the note again only when its range can't be mapped, and
	// `noteText` is then what it reads.
	outsideChange(next: string): { lostSelected: boolean; noteText: string | null } {
		const oldLines = splitLines(this.text);
		const newLines = splitLines(next);
		this.text = next;
		const map = (line: number | null) => (line === null ? null : mapLine(oldLines, newLines, line));
		for (const tracked of this.tracked) tracked.line = map(tracked.line);
		const hadSelected = this.selected !== null;
		this.selected = map(this.selected);
		this.afterMove(newLines);
		let noteText: string | null = null;
		if (this.note) {
			const range = mapRange(oldLines, newLines, this.note.range);
			const { separator } = this.note;
			this.note.separator = separator === null ? null : mapLine(oldLines, newLines, separator);
			if (range) {
				this.note.range = range;
			} else {
				const { lines, model } = this.parse();
				this.note.range = model.listNote;
				this.note.separator = null;
				noteText = getListNote(lines, model);
			}
		}
		return { lostSelected: hadSelected && this.selected === null, noteText };
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

	private apply(next: string, start: number, kind: RunEdit['kind'], from?: object): OwnEdit {
		const edit = ownEdit(start, this.text, next, kind);
		this.follow(next, edit, from);
		return edit;
	}

	// The list note's own saves replace its range instead, so `from` skips it.
	private follow(next: string, edit: OwnEdit, from?: object): void {
		this.text = next;
		for (const tracked of this.tracked) tracked.line = tracked.line === null ? null : followLine(tracked.line, edit);
		const selected = this.selected;
		this.selected = selected === null ? null : followLine(selected, edit);
		this.afterMove(splitLines(next), edit.kind !== 'move' && edit.start === selected ? edit.retitle : undefined);
		if (this.note && this.note !== from) {
			const { separator } = this.note;
			this.note.separator = separator === null ? null : followLine(separator, edit);
			// No own edit starts inside the note. If one did, the field's text would win over the
			// note as the file now parses.
			this.note.range = followRange(this.note.range, edit) ?? this.parse().model.listNote;
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
			this.title = syncTitleField(this.title, line.text, retitle);
		}
	}

	private endCard(): void {
		this.title = null;
		this.notes = null;
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

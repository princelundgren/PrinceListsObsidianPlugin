import { EditorSelection, Prec, StateEffect, StateField, type Range, type Text } from '@codemirror/state';
import { Decoration, EditorView, keymap, WidgetType, type Command, type DecorationSet } from '@codemirror/view';
import { drawnBlocks, spanCrossed, type DrawnBlock } from '../core/drawn-blocks';
import type { PrinceListView } from './list-view';
import { renderIntoWidget, unloadWidget } from './notes-widgets';

export const NOTES_BLOCK_CLASS = 'princelists-notes-block';

/** The notes' drawn blocks: their widgets, and the editor's span of each block a widget takes. */
export interface DrawnBlocks {
	readonly decorations: DecorationSet;
	readonly spans: readonly Span[];
}

/** An editor span, from and to as positions in the notes. */
export interface Span {
	from: number;
	to: number;
}

interface PlacedBlock extends Span {
	kind: DrawnBlock['kind'];
	markdown: string;
}

interface FieldValue extends DrawnBlocks {
	blocks: readonly PlacedBlock[];
	hasFocus: boolean;
}

const focusChanged = StateEffect.define<boolean>();

/**
 * The notes' tables, code, callouts, math, embeds and HTML blocks, each drawn whole by Obsidian's
 * renderer in a block widget, except the ones the selection touches while the editor has focus,
 * which show their Markdown. Links in them resolve as in `sourcePath`.
 */
export function drawnBlocksField(view: PrinceListView, sourcePath: string): StateField<DrawnBlocks> {
	const draw = (blocks: readonly PlacedBlock[], hasFocus: boolean, selection: EditorSelection): FieldValue => {
		const drawn = blocks.filter((block) => !hasFocus || !selection.ranges.some((range) => range.from <= block.to && range.to >= block.from));
		const ranges: Range<Decoration>[] = drawn.map((block) =>
			Decoration.replace({ block: true, widget: new BlockWidget(block.markdown, block.kind, view, sourcePath) }).range(block.from, block.to),
		);
		return { blocks, hasFocus, decorations: Decoration.set(ranges), spans: drawn };
	};
	return StateField.define<FieldValue>({
		create: (state) => draw(placedBlocks(state.doc), false, state.selection),
		update: (value, tr) => {
			const blocks = tr.docChanged ? placedBlocks(tr.state.doc) : value.blocks;
			let { hasFocus } = value;
			for (const effect of tr.effects) if (effect.is(focusChanged)) hasFocus = effect.value;
			if (blocks === value.blocks && hasFocus === value.hasFocus && !tr.selection) return value;
			return draw(blocks, hasFocus, tr.state.selection);
		},
		// A StateField can't read the view's focus, so the focus change comes to it as an effect.
		provide: (field) => [
			EditorView.decorations.from(field, (value) => value.decorations),
			EditorView.focusChangeEffect.of((_state, focusing) => focusChanged.of(focusing)),
			Prec.high(keymap.of([{ key: 'ArrowDown', run: stopAtBlock(field, true) }, { key: 'ArrowUp', run: stopAtBlock(field, false) }])),
		],
	});
}

// CodeMirror's vertical motion passes a block widget by. Up or down onto a drawn block, the caret stops
// at its start or end instead, which shows its Markdown, as Live Preview's arrow keys enter a block.
function stopAtBlock(field: StateField<DrawnBlocks>, forward: boolean): Command {
	return (editor) => {
		const { ranges } = editor.state.selection;
		const [cursor] = ranges;
		if (ranges.length !== 1 || !cursor?.empty) return false;
		const moved = editor.moveVertically(cursor, forward);
		const passed = spanCrossed(editor.state.field(field).spans, cursor.head, moved.head);
		if (!passed) return false;
		// The goal column goes along, so the next Up or Down leaves the block in the column it came from.
		const stop = EditorSelection.cursor(forward ? passed.from : passed.to, undefined, undefined, moved.goalColumn);
		editor.dispatch({ selection: EditorSelection.create([stop]), scrollIntoView: true, userEvent: 'select' });
		return true;
	};
}

function placedBlocks(doc: Text): PlacedBlock[] {
	return drawnBlocks(doc.toString()).map(({ lines, kind, markdown }) => ({ from: doc.line(lines.start + 1).from, to: doc.line(lines.end).to, kind, markdown }));
}

// Drawn again only when its own Markdown changes, so typing elsewhere leaves it, and its embeds, be.
class BlockWidget extends WidgetType {
	constructor(
		readonly markdown: string,
		readonly kind: DrawnBlock['kind'],
		private readonly view: PrinceListView,
		private readonly sourcePath: string,
	) {
		super();
	}

	eq(other: BlockWidget): boolean {
		return other.markdown === this.markdown && other.kind === this.kind;
	}

	toDOM(): HTMLElement {
		const el = createDiv({ cls: NOTES_BLOCK_CLASS });
		renderIntoWidget(this.view, this.sourcePath, el, this.markdown);
		return el;
	}

	destroy(dom: HTMLElement): void {
		unloadWidget(this.view, dom);
	}

	// The editor's mousedown handler shows the block's Markdown, leaves a link or button in it be, or
	// hands a modified press on to CodeMirror's own.
	ignoreEvent(event: Event): boolean {
		return event.type !== 'mousedown';
	}
}

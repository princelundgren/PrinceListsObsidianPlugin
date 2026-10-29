import type { EditorState, Range, SelectionRange } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import type { Span } from './notes-blocks';

/** Hides what it covers. */
export const HIDDEN = Decoration.replace({});
const FAINT = Decoration.mark({ class: 'princelists-notes-markup' });

/**
 * The notes drawing's decorations so far, and what the selection shows as typed. It adds none within
 * `covered`, the spans a block widget takes.
 */
export class Drawing {
	readonly ranges: Range<Decoration>[] = [];

	constructor(
		readonly state: EditorState,
		private readonly selection: readonly SelectionRange[],
		private readonly covered: readonly Span[],
	) {}

	touches(from: number, to: number): boolean {
		return this.selection.some((range) => range.from <= to && range.to >= from);
	}

	touchesLine(pos: number): boolean {
		const line = this.state.doc.lineAt(pos);
		return this.touches(line.from, line.to);
	}

	// Nothing for an empty range: CodeMirror refuses an empty mark.
	add(decoration: Decoration, from: number, to: number): void {
		if (from < to && !this.isCovered(from, to)) this.ranges.push(decoration.range(from, to));
	}

	widget(decoration: Decoration, at: number): void {
		if (!this.isCovered(at, at)) this.ranges.push(decoration.range(at));
	}

	// A node's own Markdown: faint while shown, hidden otherwise.
	markup(from: number, to: number, isShown: boolean): void {
		this.add(isShown ? FAINT : HIDDEN, from, to);
	}

	lineClass(from: number, to: number, className: string): void {
		const { doc } = this.state;
		for (let number = doc.lineAt(from).number; number <= doc.lineAt(to).number; number++) {
			const line = doc.line(number);
			if (!this.isCovered(line.from, line.from)) this.ranges.push(Decoration.line({ class: className }).range(line.from));
		}
	}

	private isCovered(from: number, to: number): boolean {
		return this.covered.some((span) => from <= span.to && to >= span.from);
	}
}

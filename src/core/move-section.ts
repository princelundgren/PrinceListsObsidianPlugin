import type { Line } from './lines';
import type { ListModel, Section } from './parse';
import { range, reorderChecked } from './reorder';

// The section's lines, from its heading to the next heading, go before `before`'s heading, or to the
// end when `before` is null. A deeper heading below it starts a section of its own, so it stays.
export function moveSectionWithLineMap(
	lines: readonly Line[],
	model: ListModel,
	section: Section,
	before: Section | null,
): { lines: Line[]; moved: (number | null)[] } {
	const start = section.headingLine as number;
	const taken = range(start, section.endLine);
	const rest = [...range(0, start), ...range(section.endLine, lines.length)];
	const at = before === null ? rest.length : rest.indexOf(before.headingLine as number);
	return reorderChecked(lines, model, [...rest.slice(0, at), ...taken, ...rest.slice(at)]);
}

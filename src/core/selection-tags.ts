import { groupState } from './group-edits';
import { itemTags } from './item-tags';
import { splitLines } from './lines';
import { itemAt, parseList } from './parse';
import { sameTag } from './tags';

/** What the selected rows say about tags, for the tag popover. */
export interface SelectionTags {
	/** The items among the selected rows. */
	items: number;
	/** The tail tags the items carry, each with the number of items that carry it. */
	chips: { tag: string; count: number }[];
	/** The tags, title or tail, that every selected item has. */
	shared: string[];
}

/**
 * Works out the tags of the items on `rows`; headings and other rows count for nothing. Tags that
 * differ only in letter case are one chip, spelled as `order` spells it; chips follow `order`, then
 * the tags it lacks in the order of the rows, spelled as the first item with the tag spells it.
 * `shared` lists the tags every item has, as the first item spells them.
 */
export function selectionTags(text: string, contentStart: number, rows: readonly number[], order: readonly string[]): SelectionTags {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const perItem = [...new Set(rows)]
		.sort((a, b) => a - b)
		.filter((row) => itemAt(model, row))
		.map((row) => itemTags(lines[row]?.text ?? ''));

	const found: { tag: string; count: number }[] = [];
	for (const { tailTags } of perItem) {
		for (const tag of tailTags) {
			const chip = found.find((candidate) => sameTag(candidate.tag, tag));
			if (chip) chip.count++;
			else found.push({ tag, count: 1 });
		}
	}
	const ordered = order.flatMap((tag) => found.filter((chip) => sameTag(chip.tag, tag)).map((chip) => ({ ...chip, tag })));
	const rest = found.filter((chip) => !order.some((tag) => sameTag(tag, chip.tag)));

	const shared = (perItem[0]?.tags ?? []).filter((tag) => perItem.every(({ tags }) => tags.some((other) => sameTag(other, tag))));
	return { items: groupState(text, contentStart, rows).items, chips: [...ordered, ...rest], shared };
}

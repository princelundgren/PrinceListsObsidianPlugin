// A list block in a list's notes draws rows with the view's classes and LINE_ATTR, for another list's lines.

/** The class of a list block's container (spec, "A list inside another note"). */
export const LIST_BLOCK_CLASS = 'princelists-block';

/**
 * Whether `el`, under `root`, is part of a list block drawn inside `root`, such as one in the list
 * note. A block's own elements, under a `root` inside the block, aren't.
 */
export function isInNestedBlock(root: Element, el: Element): boolean {
	const block = el.closest(`.${LIST_BLOCK_CLASS}`);
	return block !== null && !block.contains(root);
}

/** The elements under `root` that match `selector`, in document order, less any in a nested list block. */
export function ownElements(root: Element, selector: string): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => !isInNestedBlock(root, el));
}

/** The first of `ownElements`, or null. */
export function ownElement(root: Element, selector: string): HTMLElement | null {
	return Array.from(root.querySelectorAll<HTMLElement>(selector)).find((el) => !isInNestedBlock(root, el)) ?? null;
}

/**
 * `target` or its closest ancestor under `root` that matches `selector`, or null when there is none
 * or `target` is in a nested list block.
 */
export function ownClosest(root: Element, target: Element, selector: string): HTMLElement | null {
	if (isInNestedBlock(root, target)) return null;
	const match = target.closest<HTMLElement>(selector);
	return match && root.contains(match) ? match : null;
}

/**
 * The elements under `root` that `evt`'s dispatch runs through, target first, from the path dispatch
 * fixes before any listener runs: one a listener has since removed, such as a list block's title that
 * its field replaced, still counts. Empty when the event isn't under `root`.
 */
export function pathUnder(root: Element, evt: Event): HTMLElement[] {
	const path = evt.composedPath();
	const at = path.indexOf(root);
	if (at === -1) return [];
	return (path.slice(0, at) as Node[]).filter((node): node is HTMLElement => node.instanceOf(HTMLElement));
}

/** Whether `evt` reached `root` through a list block drawn inside it, as `isInNestedBlock`, from its path. */
export function eventInNestedBlock(root: Element, evt: Event): boolean {
	return pathUnder(root, evt).some((el) => el.hasClass(LIST_BLOCK_CLASS));
}

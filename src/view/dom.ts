// Moves `fresh`'s content into `target` in place of what `target` holds. `kept`, an element under
// `target` that holds focus, stays attached where `slot` sits in `fresh`, with every ancestor up to
// `target`: removing a focused element from the document blurs it, which would end its typing
// session (spec, "Saving and outside changes"). At each level the kept ancestor takes the children of
// its counterpart around the slot, so `kept` and `slot` must sit at the same depth.
export function replaceKeeping(target: HTMLElement, fresh: HTMLElement, kept: HTMLElement | null, slot: HTMLElement | null): void {
	if (!kept || !slot) {
		target.replaceChildren(...Array.from(fresh.childNodes));
		return;
	}
	let keep: HTMLElement = kept;
	let put: HTMLElement = slot;
	while (keep !== target) {
		const keepParent = keep.parentElement;
		const putParent = put.parentElement;
		if (!keepParent || !putParent) throw new Error('The kept element and its slot are at different depths');
		for (const child of Array.from(keepParent.childNodes)) if (child !== keep) child.remove();
		const siblings = Array.from(putParent.childNodes);
		const at = siblings.indexOf(put);
		keep.before(...siblings.slice(0, at));
		keep.after(...siblings.slice(at + 1));
		keep = keepParent;
		put = putParent;
	}
}

// A textarea as tall as its text, so a title wraps like text and notes need no scrolling of their own.
// It must be in the document, or its scrollHeight is 0.
export function fitHeight(textarea: HTMLTextAreaElement): void {
	textarea.setCssProps({ height: 'auto' });
	textarea.setCssProps({ height: `${textarea.scrollHeight}px` });
}

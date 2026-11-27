import type { Find } from '../../src/core/display';
import type { Span } from '../../src/core/find-spans';

/** A stand-in for the view's findOf, which needs Obsidian: every place each lowercased word appears. */
export function findOf(query: string): Find | null {
	const trimmed = query.trim();
	if (!trimmed) return null;
	const words = trimmed.toLowerCase().split(/\s+/).map((word) => (text: string) => {
		const spans: Span[] = [];
		const lower = text.toLowerCase();
		for (let at = lower.indexOf(word); at >= 0; at = lower.indexOf(word, at + word.length)) spans.push([at, at + word.length]);
		return spans.length ? spans : null;
	});
	return { text: query, words, matches: () => true };
}

import { expect, test } from 'vitest';
import { doneAt } from '../../src/core/archive';
import { isRepeating, parseItemLine, untickLine } from '../../src/core/item-line';
import { setWhen, whenOf } from '../../src/core/when';

// A pasted run of spaces, with an emoji on the line: V8 skips a search for an emoji in a line without one.
const RUN = ' '.repeat(40_000);
const NOW = new Date(2026, 9, 28, 12, 0);

test.each([
	['parseItemLine', () => parseItemLine(`- [x] a ✔ 2026-10-20 10:00${RUN}x`)],
	['isRepeating', () => isRepeating(`- [ ] a 🔁${RUN}x.`)],
	['untickLine', () => untickLine(`- [x] a${RUN}📅 2026-10-30`)],
	['doneAt', () => doneAt(`- [x] a${RUN}📅 2026-10-30`, NOW)],
	['whenOf', () => whenOf(`- [ ] a${RUN}📅 2026-10-30`)],
	['setWhen', () => setWhen(`- [ ] a${RUN}📅 2026-10-30`, '2026-11-01')],
])('%s takes under 100 ms on a long run of spaces', (_name, call) => {
	const start = performance.now();
	call();
	expect(performance.now() - start).toBeLessThan(100);
});

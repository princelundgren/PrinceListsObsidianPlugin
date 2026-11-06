import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('styles.css has no :has(), which the community directory review warns against', () => {
	const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
	expect(styles).not.toMatch(/:has\(/);
});

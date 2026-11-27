import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { THEME_COLORS } from '../src/core/theme-color';

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('styles.css has no :has(), which the community directory review warns against', () => {
	expect(styles).not.toMatch(/:has\(/);
});

test.each(THEME_COLORS)('styles.css gives the star a color for %s', (color) => {
	expect(styles).toContain(`.princelists-star-color-${color} {`);
});

test('styles.css lays the settings preview out under its name', () => {
	expect(styles).toContain('.princelists-settings-preview {');
});

test('styles.css stretches the settings preview across the row when Obsidian stacks it', () => {
	const rule = styles.match(/\.princelists-settings-preview > \.princelists-settings-preview-rows \{([^}]*)\}/)?.[1];
	expect(rule).toContain('align-self: stretch;');
});

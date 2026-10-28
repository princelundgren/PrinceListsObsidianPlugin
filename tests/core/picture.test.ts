import { expect, test } from 'vitest';
import { pictureName } from '../../src/core/picture';

const now = new Date(2026, 9, 22, 14, 30, 5);

test.each([
	[{ name: 'image.png', type: 'image/png' }, true, 'Pasted image 20261022143005.png'],
	[{ name: 'image.jpeg', type: 'image/jpeg' }, true, 'Pasted image 20261022143005.jpg'],
	[{ name: 'x.svg', type: 'image/svg+xml' }, true, 'Pasted image 20261022143005.svg'],
	[{ name: 'IMG_0042.JPG', type: 'image/jpeg' }, false, 'IMG_0042.JPG'],
	[{ name: 'Plan [v2] #3.png', type: 'image/png' }, false, 'Plan -v2- -3.png'],
	[{ name: 'a^b|c.png', type: 'image/png' }, false, 'a-b-c.png'],
	[{ name: 'IMG_0042.HEIC', type: 'image/heic' }, false, null],
	[{ name: 'image.heic', type: 'image/heic' }, true, null],
	[{ name: 'notes.pdf', type: 'application/pdf' }, false, null],
])('names %j (pasted: %s) as %s', (file, pasted, expected) => {
	expect(pictureName(file, pasted, now)).toBe(expected);
});

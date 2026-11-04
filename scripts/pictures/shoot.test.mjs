import assert from 'node:assert/strict';
import { test } from 'node:test';
import { desktopSceneNames } from './shoot.mjs';

test('the desktop scenes are every scene in scenes/ that is not a phone\'s, in name order', async () => {
	// Reads the real scenes/ folder, so adding or removing a scene there changes what this sees.
	const names = await desktopSceneNames();
	assert.ok(names.includes('embedded-list'));
	assert.ok(names.includes('desktop-1-groceries'));
	assert.ok(!names.includes('tick-and-drag'));
	assert.ok(!names.some((name) => name.startsWith('phone-')));
	assert.deepEqual(names, [...names].sort());
});

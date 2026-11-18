import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captioned } from './caption.mjs';

// Stands in for a session whose screenshot gives `screenshot`, or throws when it is an Error, and
// records the page scripts it runs.
function fakeSession(screenshot) {
	const scripts = [];
	return {
		scripts,
		evaluate: async (expression) => scripts.push(expression),
		send: async () => {
			if (screenshot instanceof Error) throw screenshot;
			return { data: screenshot };
		},
	};
}

test('the captioned picture is a screenshot of the layout, which is removed after', async () => {
	const session = fakeSession('captioned');
	assert.equal(await captioned(session, 'shot', 'Find items'), 'captioned');
	assert.match(session.scripts[0], /"Find items"/);
	assert.match(session.scripts.at(-1), /^document\.getElementById\('princelists-picture-caption'\)\?\.remove\(\)$/);
});

test('the layout is removed when the screenshot fails', async () => {
	const session = fakeSession(new Error('no page'));
	await assert.rejects(captioned(session, 'shot', 'Find items'), /no page/);
	assert.match(session.scripts.at(-1), /remove\(\)$/);
});

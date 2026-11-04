// Runs with `node --test "scripts/pictures/*.test.mjs"`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkDemoVault, pickPage, vaultProblem } from './cdp.mjs';

const target = (type, url, title = '') => ({ type, url, title, webSocketDebuggerUrl: `ws://x/${url}` });
const desktop = target('page', 'app://obsidian.md/index.html');
// Stands in for a session: answers checkDemoVault's one question with what the page would say.
const fakeSession = (answer) => ({ evaluate: async () => answer });

test('pickPage takes the app page among DevTools and a worker', () => {
	assert.equal(pickPage([target('page', 'devtools://devtools/inspector.html'),
		target('service_worker', 'app://obsidian.md/sw.js'), desktop]), desktop.webSocketDebuggerUrl);
});

test('pickPage takes the Android app page', () => {
	const phone = target('page', 'http://localhost/');
	assert.equal(pickPage([phone]), phone.webSocketDebuggerUrl);
});

test('pickPage throws listing the targets when there is no app page', () => {
	assert.throws(() => pickPage([target('page', 'devtools://devtools/inspector.html')]),
		/page devtools:\/\/devtools\/inspector\.html/);
});

test('pickPage throws listing the targets when there are two app pages', () => {
	assert.throws(() => pickPage([desktop, desktop]), /page app:\/\/obsidian\.md\/index\.html/);
});

test('pickPage names each app page by its title when there are two', () => {
	const titled = (title) => target('page', 'app://obsidian.md/index.html', title);
	assert.throws(() => pickPage([titled('Groceries - Demo - Obsidian 1.15.0'), titled('Settings - Demo - Obsidian 1.15.0')]),
		/"Groceries - Demo - Obsidian 1\.15\.0"\n.*"Settings - Demo - Obsidian 1\.15\.0"/);
});

test('pickPage keeps a title with a line break on its target\'s line', () => {
	assert.throws(() => pickPage([target('page', 'devtools://devtools/inspector.html', 'One\nTwo')]),
		/inspector\.html "One\\nTwo"$/);
});

const dark = { nativeMenus: false, theme: 'obsidian' };

test('vaultProblem names a vault without the marker', () => {
	assert.match(vaultProblem({ marker: false, name: 'Notes', appearance: dark }, 'dark'), /"Notes" isn't a copy/);
});

test('vaultProblem counts native menus as on when the setting is missing', () => {
	assert.match(vaultProblem({ marker: true, name: 'Demo', appearance: { theme: 'obsidian' } }, 'dark'), /Native menus are on/);
});

test('vaultProblem refuses a light copy for a dark scene', () => {
	assert.match(vaultProblem({ marker: true, name: 'Demo', appearance: { nativeMenus: false, theme: 'moonstone' } }, 'dark'),
		/--theme dark/);
});

test('vaultProblem passes a dark copy with native menus off', () => {
	assert.equal(vaultProblem({ marker: true, name: 'Demo', appearance: dark }, 'dark'), null);
});

test('checkDemoVault throws the problem the page describes', async () => {
	await assert.rejects(checkDemoVault(fakeSession({ marker: false, name: 'Notes', appearance: dark }), 'dark'), /Notes/);
});

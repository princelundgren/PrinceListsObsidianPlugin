// Runs with `node --test "scripts/pictures/*.test.mjs"`.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkTarget, copyDemoVault, shiftDates } from './demo-vault.mjs';

function tempFolder(t) {
	const folder = mkdtempSync(join(tmpdir(), 'demo-vault-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	return folder;
}

test('shiftDates moves each date and keeps the time and the rest of the line', () => {
	assert.equal(shiftDates('- [ ] a ⏳ 2026-10-28\n- [x] b ✔ 2026-10-27 07:45\n', 5),
		'- [ ] a ⏳ 2026-11-02\n- [x] b ✔ 2026-11-01 07:45\n');
});

test('shiftDates crosses a year end, a leap day, and goes back', () => {
	assert.equal(shiftDates('2026-12-30', 3), '2027-01-02');
	assert.equal(shiftDates('2028-02-28', 1), '2028-02-29');
	assert.equal(shiftDates('2026-03-01', -1), '2026-02-28');
});

test('shiftDates leaves a longer run of digits alone', () => {
	assert.equal(shiftDates('12026-10-280', 1), '12026-10-280');
});

test('checkTarget refuses a path that is a file', (t) => {
	const file = join(tempFolder(t), 'note.md');
	writeFileSync(file, 'mine');
	assert.throws(() => checkTarget(file), /isn't a folder/);
});

test('checkTarget refuses a folder with a file and no marker', (t) => {
	const folder = tempFolder(t);
	writeFileSync(join(folder, 'note.md'), 'mine');
	assert.throws(() => checkTarget(folder), (error) => error.message.includes(folder));
});

test('checkTarget refuses a linked .obsidian, even in an earlier copy', (t) => {
	const otherVault = tempFolder(t);
	mkdirSync(join(otherVault, '.obsidian'));
	const folder = tempFolder(t);
	writeFileSync(join(folder, '.princelists-demo'), '');
	symlinkSync(join(otherVault, '.obsidian'), join(folder, '.obsidian'));
	assert.throws(() => checkTarget(folder), /is a link/);
});

test('checkTarget refuses a .obsidian link whose target is gone', (t) => {
	const folder = tempFolder(t);
	symlinkSync(join(tempFolder(t), 'moved'), join(folder, '.obsidian'));
	assert.throws(() => checkTarget(folder), /is a link/);
});

test('checkTarget takes a missing folder, a new vault and an earlier copy', (t) => {
	checkTarget(join(tempFolder(t), 'missing'));
	const newVault = tempFolder(t);
	mkdirSync(join(newVault, '.obsidian'));
	writeFileSync(join(newVault, '.obsidian', 'app.json'), '{}');
	checkTarget(newVault);
	const earlierCopy = tempFolder(t);
	writeFileSync(join(earlierCopy, '.princelists-demo'), '');
	writeFileSync(join(earlierCopy, 'note.md'), 'demo');
	checkTarget(earlierCopy);
});

test('a copy over an earlier one moves the dates and keeps only the plugins folder', (t) => {
	const folder = tempFolder(t);
	writeFileSync(join(folder, '.princelists-demo'), '');
	writeFileSync(join(folder, 'Left over.md'), 'from an earlier scene');
	mkdirSync(join(folder, '.obsidian', 'plugins', 'x'), { recursive: true });
	writeFileSync(join(folder, '.obsidian', 'plugins', 'x', 'main.js'), 'build');
	writeFileSync(join(folder, '.obsidian', 'plugins', 'x', 'notes.md'), 'due 2026-10-28');
	writeFileSync(join(folder, '.obsidian', 'graph.json'), '{}');

	copyDemoVault(folder, { theme: 'light', today: '2026-11-04' });

	assert.match(readFileSync(join(folder, 'To do.md'), 'utf8'), /return the library books ⏳ 2026-11-04/);
	assert.equal(readFileSync(join(folder, '.obsidian', 'plugins', 'x', 'main.js'), 'utf8'), 'build');
	assert.equal(readFileSync(join(folder, '.obsidian', 'plugins', 'x', 'notes.md'), 'utf8'), 'due 2026-10-28');
	assert.equal(JSON.parse(readFileSync(join(folder, '.obsidian', 'appearance.json'), 'utf8')).theme, 'moonstone');
	assert.ok(!existsSync(join(folder, 'Left over.md')));
	assert.ok(!existsSync(join(folder, '.obsidian', 'graph.json')));
});

test('a copy into a new folder writes the marker and leaves the pictures byte for byte', (t) => {
	const folder = join(tempFolder(t), 'vault');
	copyDemoVault(folder, { theme: 'dark', today: '2027-01-01' });
	assert.ok(existsSync(join(folder, '.princelists-demo')));
	const picture = 'Attachments/raised-bed.jpg';
	assert.deepEqual(readFileSync(join(folder, picture)),
		readFileSync(new URL(`../../demo/vault/${picture}`, import.meta.url)));
});

test('a copy into a new vault keeps the settings the demo vault does not ship', (t) => {
	const folder = tempFolder(t);
	mkdirSync(join(folder, '.obsidian'));
	writeFileSync(join(folder, '.obsidian', 'hotkeys.json'), '{}');
	copyDemoVault(folder, { theme: 'dark', today: '2026-10-28' });
	assert.equal(readFileSync(join(folder, '.obsidian', 'hotkeys.json'), 'utf8'), '{}');
	assert.ok(existsSync(join(folder, '.obsidian', 'appearance.json')));
});

test('a copy with a day or theme that does not exist deletes nothing', (t) => {
	const folder = tempFolder(t);
	writeFileSync(join(folder, '.princelists-demo'), '');
	writeFileSync(join(folder, 'Left over.md'), 'from an earlier scene');
	assert.throws(() => copyDemoVault(folder, { theme: 'dark', today: '2026-02-30' }), /2026-02-30/);
	assert.throws(() => copyDemoVault(folder, { theme: 'toString', today: '2026-11-04' }), /toString/);
	assert.ok(existsSync(join(folder, 'Left over.md')));
});

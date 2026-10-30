// Runs with `node --test "scripts/pictures/*.test.mjs"`.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkCopy, filesToPush, pushProblem } from './push-vault.mjs';

function tempFolder(t) {
	const folder = mkdtempSync(join(tmpdir(), 'push-vault-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	return folder;
}

test('filesToPush lists every file once, with its path inside the vault', (t) => {
	const folder = tempFolder(t);
	const picture = Buffer.from([0xff, 0xd8, 0x00, 0x7f]);
	mkdirSync(join(folder, 'Attachments'));
	writeFileSync(join(folder, '.princelists-demo'), '');
	writeFileSync(join(folder, 'To do.md'), 'a list');
	writeFileSync(join(folder, 'Attachments', 'suitcase.jpg'), picture);

	const files = filesToPush(folder);

	assert.deepEqual(files.map(({ path }) => path).sort(), ['.princelists-demo', 'Attachments/suitcase.jpg', 'To do.md']);
	const { base64 } = files.find(({ path }) => path.endsWith('.jpg'));
	assert.deepEqual(Buffer.from(base64, 'base64'), picture);
});

test('checkCopy refuses a folder that is not a copy of the demo vault', (t) => {
	const folder = tempFolder(t);
	writeFileSync(join(folder, 'note.md'), 'mine');
	assert.throws(() => checkCopy(folder), (error) => error.message.includes(folder));
});

test('checkCopy takes a copy', (t) => {
	const folder = tempFolder(t);
	writeFileSync(join(folder, '.princelists-demo'), '');
	checkCopy(folder);
});

test('pushProblem refuses a vault with files outside its config folder and no marker', () => {
	const vault = { name: 'Notes', marker: false, configDir: '.obsidian', files: ['.obsidian/app.json', 'note.md'] };
	assert.match(pushProblem(vault), /Notes/);
});

test('pushProblem takes a new vault, whose only files are its settings', () => {
	const vault = { name: 'New', marker: false, configDir: '.obsidian', files: ['.obsidian/app.json'] };
	assert.equal(pushProblem(vault), null);
});

test('pushProblem takes an earlier copy', () => {
	const vault = { name: 'Demo', marker: true, configDir: '.obsidian', files: ['.princelists-demo', 'To do.md'] };
	assert.equal(pushProblem(vault), null);
});

test('pushProblem reads the config folder the vault uses', () => {
	const vault = { name: 'Notes', marker: false, configDir: '.config', files: ['.obsidian/app.json'] };
	assert.match(pushProblem(vault), /Notes/);
});

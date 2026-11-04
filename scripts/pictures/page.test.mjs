import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { drawnMouse, glideOver, showAlone, sleep, undoingChanges } from './page.mjs';

test('a glide whose steps are slow still ends on time, at its end', async () => {
	// Real timers: each step takes 40 ms, as input sent to an emulator can. The bound leaves slack.
	const fractions = [];
	const start = Date.now();
	await glideOver(200, async (done) => {
		fractions.push(done);
		await sleep(40);
	});
	const elapsed = Date.now() - start;
	assert.ok(elapsed >= 200 && elapsed < 400, `took ${elapsed} ms`);
	assert.ok(fractions.length >= 3);
	assert.equal(fractions.at(-1), 1);
	assert.ok(fractions.every((done, i) => i === 0 || done >= fractions[i - 1]));
});

test('drag lets go of the button and ends interception when no drag starts', async () => {
	// The fake never reports a drag, so this waits out the real two-second timeout.
	const sent = [];
	const session = {
		evaluate: async () => {},
		on: () => {},
		send: async (method, params) => {
			sent.push({ method, ...params });
		},
	};
	await assert.rejects(drawnMouse(session, 10, 20).drag(100, 200), /No drag started at/);
	assert.ok(sent.some(({ type }) => type === 'mouseReleased'));
	assert.deepEqual(sent.filter(({ method }) => method === 'Input.setInterceptDrags').at(-1), { method: 'Input.setInterceptDrags', enabled: false });
});

// Stands in for a session on a vault held in `files`: runs what's evaluated against a fake adapter.
function vaultSession(files) {
	const adapter = {
		read: async (path) => files.get(path),
		write: async (path, text) => {
			files.set(path, text);
		},
		remove: async (path) => {
			files.delete(path);
		},
		list: async (folder) => ({ files: [...files.keys()].filter((path) => path.startsWith(`${folder}/`)) }),
	};
	return { evaluate: async (expression) => runInNewContext(expression, { app: { vault: { adapter } } }) };
}

test('undoingChanges puts the note back and removes only added files when the scene fails', async () => {
	const files = new Map([['To do.md', 'before'], ['Attachments/kept.jpg', 'kept'], ['Other/left.jpg', 'left']]);
	const failing = async () => {
		files.set('To do.md', 'after');
		files.set('Attachments/added.jpg', 'added');
		throw new Error('the scene failed');
	};
	await assert.rejects(undoingChanges(vaultSession(files), 'To do.md', 'Attachments', failing), /the scene failed/);
	assert.deepEqual([...files], [['To do.md', 'before'], ['Attachments/kept.jpg', 'kept'], ['Other/left.jpg', 'left']]);
});

test('showAlone refuses a view it has no state for, before touching the page', async () => {
	const evaluated = [];
	const session = { evaluate: async (expression) => evaluated.push(expression) };
	await assert.rejects(showAlone(session, 'To do.md', 'preview'), /not "preview"/);
	assert.deepEqual(evaluated, []);
});

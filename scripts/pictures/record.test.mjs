import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { record } from './record.mjs';

// Stands in for a session: remembers what's sent, and paints a frame only when a test calls `paint`.
function fakeSession() {
	const sent = [];
	let listener;
	return {
		sent,
		on: (_, onFrame) => {
			listener = onFrame;
		},
		send: async (method) => {
			sent.push(method);
		},
		paint: (data) => listener({ data, sessionId: 1, metadata: { deviceWidth: 720, deviceHeight: 603 } }),
	};
}

test('record stops the screencast and passes on the error when the scene fails', async () => {
	const session = fakeSession();
	const failing = async () => {
		throw new Error('the scene failed');
	};
	await assert.rejects(record(session, failing, 'unused'), /the scene failed/);
	assert.ok(session.sent.includes('Page.stopScreencast'));
});

test('record says so when the page painted nothing', async () => {
	await assert.rejects(record(fakeSession(), async () => {}, 'unused'), /No frames arrived/);
});

test('record has every frame saved when it returns, and saves none that arrive after the stop', async () => {
	const folder = mkdtempSync(join(tmpdir(), 'princelists-record-test-'));
	try {
		const session = fakeSession();
		// Large enough that the write is still going when the scene ends.
		const painted = Buffer.alloc(4_000_000, 7);
		await record(session, async () => session.paint(painted.toString('base64')), folder);
		assert.deepEqual(readFileSync(join(folder, 'frame-00000.png')), painted);
		// Chromium can finish encoding a frame after it has answered the stop.
		session.paint('');
		await wait(20);
		assert.deepEqual(readdirSync(folder), ['frame-00000.png']);
		assert.equal(session.sent.filter((method) => method === 'Page.screencastFrameAck').length, 2);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
});

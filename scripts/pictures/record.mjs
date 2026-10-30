// Records what the page shows while a scene acts on it.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toGif } from './encode.mjs';

/**
 * Runs `act` while saving each frame the page paints as a PNG in `folder`. Returns the `frames` in
 * order, each with its `file` and the `ms` it lasted, until the next frame or the end of `act`, and
 * the `screen` they show, in CSS pixels. Throws when no frame arrives.
 */
export async function record(session, act, folder) {
	const frames = [];
	let screen;
	let saving = Promise.resolve();
	let isRecording = true;
	session.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
		session.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
		if (!isRecording) return;
		const file = join(folder, `frame-${String(frames.length).padStart(5, '0')}.png`);
		frames.push({ file, arrived: Date.now() });
		screen ??= { width: metadata.deviceWidth, height: metadata.deviceHeight };
		saving = Promise.all([saving, writeFile(file, Buffer.from(data, 'base64'))]);
	});
	await session.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
	let end;
	try {
		await act();
	} finally {
		await session.send('Page.stopScreencast');
		isRecording = false;
		end = Date.now();
		await saving;
	}
	if (frames.length === 0) throw new Error('No frames arrived from the page while recording. Check that Obsidian is on screen and painting.');
	return { screen, frames: frames.map(({ file, arrived }, index) => ({ file, ms: (frames[index + 1]?.arrived ?? end) - arrived })) };
}

/** Records `act` and saves it as `<out>/<scene name>.gif`, at the scene's page size. */
export async function recordGif(session, scene, out, act) {
	const folder = await mkdtemp(join(tmpdir(), 'princelists-gif-'));
	try {
		const { frames, screen } = await record(session, act, folder);
		toGif(frames, join(out, `${scene.name}.gif`), scene.page, screen);
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}

// What scenes do on Obsidian's page: find where an element is, move, click, scroll, type and press
// keys through CDP input events, open a note, list or the Schedule, and save a still.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toWebp } from './encode.mjs';
import { pointer } from './pointer.mjs';

const TYPING_MS = 35;
const GLIDE_STEP_MS = 16;
const DRAG_START_MS = 2000;
const FINGER_LINGER_MS = 200;
const TAP_MS = 100;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns the bounds, in CSS pixels, of the first element matching the CSS `selector` whose text is
 * `text` when one is given. Throws naming what it looked for when nothing matches.
 */
export async function boundsOf(session, selector, text) {
	const bounds = await session.evaluate(`(() => {
		const text = ${JSON.stringify(text ?? null)};
		const found = [...document.querySelectorAll(${JSON.stringify(selector)})]
			.find((el) => text === null || el.textContent.trim() === text);
		if (!found) return null;
		const { x, y, width, height } = found.getBoundingClientRect();
		return { x, y, width, height };
	})()`);
	if (!bounds) throw new Error(`Nothing on the page matches ${selector}${text ? ` with the text "${text}"` : ''}.`);
	return bounds;
}

/** Returns the middle of `bounds`. */
export const middleOf = ({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 });

/** Moves the mouse to `x, y`, drawing the pointer there when `drawn` is true. */
export async function hover(session, x, y, { drawn = false } = {}) {
	await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
	if (drawn) await pointer(session, x, y, 'move');
}

/** Clicks at `x, y` with the `left` or `right` button. */
export async function click(session, x, y, button = 'left') {
	await hover(session, x, y);
	for (const type of ['mousePressed', 'mouseReleased']) {
		await session.send('Input.dispatchMouseEvent', { type, x, y, button, clickCount: 1 });
	}
}

/**
 * A mouse for recordings, starting at `x, y`: each input moves the drawn pointer too. `glide` moves
 * in steps over `ms`, so the pointer travels on screen; `press`, `release` and `click` act where it
 * is; `drag` drags what's under it to `x, y` with HTML drag and drop, rejecting if no drag starts.
 */
export function drawnMouse(session, x, y) {
	const at = { x, y };
	const sendMove = () => session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at, ...held });
	const button = (type) => session.send('Input.dispatchMouseEvent', { type, ...at, button: 'left', clickCount: 1 });
	// Chromium starts a drag only from moves that say the button is down.
	let held = {};
	const glide = async (toX, toY, ms, sendStep) => {
		const start = { ...at };
		const steps = Math.max(1, Math.round(ms / GLIDE_STEP_MS));
		for (let step = 1; step <= steps; step++) {
			// Eases out, as a hand slows onto its target.
			const done = 1 - (1 - step / steps) ** 3;
			at.x = Math.round(start.x + (toX - start.x) * done);
			at.y = Math.round(start.y + (toY - start.y) * done);
			await sendStep();
			await pointer(session, at.x, at.y, 'move');
			await sleep(GLIDE_STEP_MS);
		}
	};
	const mouse = {
		at,
		glide: (toX, toY, ms = 500) => glide(toX, toY, ms, sendMove),
		async press() {
			await button('mousePressed');
			held = { button: 'left', buttons: 1 };
		},
		async release() {
			await button('mouseReleased');
			held = {};
		},
		async click() {
			await mouse.press();
			await mouse.release();
		},
		async drag(toX, toY, ms = 900) {
			await session.send('Input.setInterceptDrags', { enabled: true });
			try {
				const started = new Promise((resolve) => session.on('Input.dragIntercepted', ({ data }) => resolve(data)));
				await mouse.press();
				await sleep(120);
				await mouse.glide(at.x + 4, at.y + 8, 80);
				const data = await withinDragStart(started, at);
				const dragEvent = (type) => session.send('Input.dispatchDragEvent', { type, ...at, data });
				await dragEvent('dragEnter');
				await glide(toX, toY, ms, () => dragEvent('dragOver'));
				await sleep(300);
				await dragEvent('drop');
			} finally {
				await mouse.release();
				await session.send('Input.setInterceptDrags', { enabled: false });
			}
		},
	};
	return mouse;
}

async function withinDragStart(started, { x, y }) {
	let timer;
	const late = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(`No drag started at ${x}, ${y}.`)), DRAG_START_MS);
	});
	try {
		return await Promise.race([started, late]);
	} finally {
		clearTimeout(timer);
	}
}

const sendTouch = (session, type, point) => session.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] });

/** Puts a finger on the page at `x, y`, drawing the finger mark there. */
export async function fingerDown(session, x, y) {
	await pointer(session, x, y, 'down');
	await sendTouch(session, 'touchStart', { x, y });
}

/** Slides the finger from `from` to `to` in small steps, over about `ms`. */
export async function fingerSlide(session, from, to, ms) {
	const steps = Math.max(1, Math.round(ms / GLIDE_STEP_MS));
	for (let step = 1; step <= steps; step++) {
		const x = Math.round(from.x + ((to.x - from.x) * step) / steps);
		const y = Math.round(from.y + ((to.y - from.y) * step) / steps);
		await pointer(session, x, y, 'down');
		await sendTouch(session, 'touchMove', { x, y });
		await sleep(GLIDE_STEP_MS);
	}
}

/** Lifts the finger from `x, y`, and the finger mark fades a moment later. */
export async function fingerUp(session, x, y) {
	await pointer(session, x, y, 'up');
	await sendTouch(session, 'touchEnd');
	await sleep(FINGER_LINGER_MS);
	await pointer(session, x, y, 'hide');
}

/** Taps the page at `x, y`, as a finger would. */
export async function tap(session, x, y) {
	await fingerDown(session, x, y);
	await sleep(TAP_MS);
	await fingerUp(session, x, y);
}

/** Turns the mouse wheel at `x, y` by `deltaY` CSS pixels, down when positive. */
export async function scroll(session, x, y, deltaY) {
	await session.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
}

/** Presses `key`, by its CDP name, typing `text` when one is given. */
export async function pressKey(session, key, text) {
	const code = { Escape: 27, Enter: 13, ArrowRight: 39 }[key];
	await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, text });
	await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
}

/** Presses Escape, which closes an open menu. */
export const pressEscape = (session) => pressKey(session, 'Escape');

/** Presses Enter. */
export const pressEnter = (session) => pressKey(session, 'Enter', '\r');

/** Types `text` a key at a time into what has focus. */
export async function type(session, text) {
	for (const char of text) {
		await session.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char, key: char });
		await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: char });
		await sleep(TYPING_MS);
	}
}

/** Shows `file` alone in the main area, as a list (`princelists-view`) or as a note in reading view. */
export const showAlone = (session, file, view) => showStateAlone(
	session,
	view === 'list' ? { type: 'princelists-view', state: { file } } : { type: 'markdown', state: { file, mode: 'preview' } },
);

/** Shows the Schedule alone in the main area. */
export const showScheduleAlone = (session) => showStateAlone(session, { type: 'princelists-schedule' });

async function showStateAlone(session, state) {
	await session.evaluate(`(async () => {
		const leaf = app.workspace.getLeaf(true);
		await leaf.setViewState(${JSON.stringify(state)});
		const others = [];
		app.workspace.iterateRootLeaves((other) => { if (other !== leaf) others.push(other); });
		for (const other of others) other.detach();
		app.workspace.setActiveLeaf(leaf, { focus: true });
	})()`);
	await sleep(600);
}

/** Opens the file explorer's top-level folders named in `open` and closes the others. */
export async function setFolders(session, open) {
	const folders = await session.evaluate(`[...document.querySelectorAll('.nav-folder-title[data-path]')]
		.filter((title) => !title.dataset.path.includes('/'))
		.map((title) => ({ path: title.dataset.path, isOpen: !title.parentElement.classList.contains('is-collapsed') }))`);
	for (const { path, isOpen } of folders) {
		if (isOpen === open.includes(path)) continue;
		const title = await boundsOf(session, `.nav-folder-title[data-path="${path}"]`);
		await click(session, title.x + Math.min(50, title.width / 2), title.y + title.height / 2);
		await sleep(300);
	}
}

/** Right-clicks the file explorer row matching `row`, then hovers the open menu's item `item`. */
export async function openMenuOn(session, row, item) {
	const target = await boundsOf(session, row);
	await click(session, target.x + Math.min(50, target.width / 2), target.y + target.height / 2, 'right');
	await sleep(600);
	const entry = await boundsOf(session, '.menu .menu-item', item);
	await hover(session, entry.x + entry.width - 14, entry.y + entry.height / 2);
	await sleep(500);
}

/**
 * Runs `act`, then puts the `note` back as it was and removes any file `act` added to `folder`, so
 * the next scene finds the vault as this one did. `folder` must exist.
 */
export async function undoingChanges(session, note, folder, act) {
	const path = JSON.stringify(note);
	const listFiles = () => session.evaluate(`app.vault.adapter.list(${JSON.stringify(folder)}).then(({ files }) => files)`);
	const text = await session.evaluate(`app.vault.adapter.read(${path})`);
	const filesBefore = await listFiles();
	try {
		await act();
	} finally {
		await session.evaluate(`app.vault.adapter.write(${path}, ${JSON.stringify(text)})`);
		for (const file of await listFiles()) {
			if (!filesBefore.includes(file)) await session.evaluate(`app.vault.adapter.remove(${JSON.stringify(file)})`);
		}
	}
}

/** Saves the scene's clip as `<out>/<scene name>.webp`. */
export async function still(session, scene, out) {
	const clip = typeof scene.clip === 'function' ? await scene.clip(session) : scene.clip;
	const { data } = await session.send('Page.captureScreenshot', { format: 'png', ...(clip && { clip: { ...clip, scale: 1 } }) });
	const folder = await mkdtemp(join(tmpdir(), 'princelists-still-'));
	try {
		const png = join(folder, `${scene.name}.png`);
		await writeFile(png, Buffer.from(data, 'base64'));
		toWebp(png, join(out, `${scene.name}.webp`));
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}

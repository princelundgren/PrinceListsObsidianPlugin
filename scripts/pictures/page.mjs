// What scenes do on Obsidian's page: find where an element is, move, click, scroll and press keys
// through CDP input events, open a note or list, and save a still.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toWebp } from './encode.mjs';
import { pointer } from './pointer.mjs';

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

/** Turns the mouse wheel at `x, y` by `deltaY` CSS pixels, down when positive. */
export async function scroll(session, x, y, deltaY) {
	await session.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
}

/** Presses Escape, which closes an open menu. */
export async function pressEscape(session) {
	for (const type of ['keyDown', 'keyUp']) {
		await session.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
	}
}

/** Shows `file` alone in the main area, as a list (`princelists-view`) or as a note in reading view. */
export async function showAlone(session, file, view) {
	const state = view === 'list' ? { type: 'princelists-view', state: { file } } : { type: 'markdown', state: { file, mode: 'preview' } };
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

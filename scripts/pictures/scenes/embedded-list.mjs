// An ordinary note in the editor: a princelists block naming Hardware store is typed in, and the
// list shows in its place once the cursor leaves the block.
import { boundsOf, drawnMouse, hover, middleOf, paneClip, pressEnter, showAlone, sleep, type, undoingChanges } from '../page.mjs';
import { pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

const NOTE = 'Weekend projects.md';
const BLOCK = '```princelists\n[[Hardware store]]\n```';
const REST = { x: 560, y: 120 };
const line = (n) => `.workspace-leaf.mod-active .cm-content > .cm-line:nth-child(${n})`;
// Obsidian saves an edit 2 s after it. Putting the note back before then lets the late save write into it.
const SAVES_SETTLE_MS = 3000;

const scene = {
	name: 'embedded-list',
	phone: false,
	// With the left sidebar collapsed, this width makes the note's text column 520 wide.
	page: { width: 644, height: 640 },
	clip: paneClip,
	scale: 1,
	theme: 'dark',
	async setup(session) {
		await showAlone(session, NOTE, 'editor');
		await hover(session, REST.x, REST.y);
	},
	async shoot(session, out) {
		const note = await session.evaluate(`app.vault.adapter.read(${JSON.stringify(NOTE)})`);
		if (!note.includes(`\n\n${BLOCK}\n\n`)) throw new Error(`${NOTE} no longer holds the Hardware store block between two paragraphs.`);
		try {
			await session.evaluate('app.workspace.leftSplit.collapse()');
			await undoingChanges(session, NOTE, 'Attachments', async () => {
				try {
					await session.evaluate(`app.workspace.activeEditor.editor.setValue(${JSON.stringify(note.replace(BLOCK, ''))})`);
					await sleep(600);
					await recordTyping(session, note, out);
				} finally {
					await sleep(SAVES_SETTLE_MS);
				}
			});
		} finally {
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};

/** Records the block typed into the empty middle line, rejecting before the GIF is saved if the note doesn't end up as `note`. */
async function recordTyping(session, note, out) {
	const mouse = drawnMouse(session, REST.x, REST.y);
	const empty = await boundsOf(session, line(3));
	await recordGif(session, scene, out, async () => {
		await pointer(session, REST.x, REST.y, 'move');
		await sleep(700);
		await mouse.glide(empty.x + 40, empty.y + empty.height / 2, 700);
		await sleep(200);
		await mouse.click();
		await sleep(400);
		await type(session, '```princelists');
		await pressEnter(session);
		await type(session, '[[Hardware');
		await sleep(700);
		// Picks Hardware store from Obsidian's link suggestions. Obsidian closed the block as its fence was typed.
		await pressEnter(session);
		await sleep(800);
		const typed = await session.evaluate('app.workspace.activeEditor.editor.getValue()');
		if (typed !== note) throw new Error(`Typing the block left ${NOTE} as ${JSON.stringify(typed)}, not as it was.`);
		const below = middleOf(await boundsOf(session, line(7)));
		await mouse.glide(below.x, below.y, 700);
		await sleep(200);
		await mouse.click();
		await sleep(900);
		await boundsOf(session, '.workspace-leaf.mod-active .princelists-block-rows');
		await mouse.glide(REST.x, REST.y, 600);
		await sleep(2200);
	});
}

export default scene;

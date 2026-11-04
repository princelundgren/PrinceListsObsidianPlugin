// On a phone, in Groceries, bananas is ticked, then "+" adds croissants with a short note, which is
// held and dragged to the top of Bakery.
import { boundsOf, fingerDown, fingerSlide, fingerUp, headingBounds, middleOf, showAlone, sleep, tap, type, undoingChanges } from '../page.mjs';
import { recordGif } from '../record.mjs';

// Typing saves 2 s after the last key, as Obsidian's requestSave waits, and later still on the
// emulator. Putting the note back before then lets the late save write into it.
const SAVES_SETTLE_MS = 6000;

const scene = {
	name: 'tick-and-drag',
	phone: true,
	page: { width: 402, height: 874 },
	scale: 1,
	theme: 'dark',
	async setup(session) {
		await showAlone(session, 'Groceries.md', 'list');
	},
	async shoot(session, out) {
		await undoingChanges(session, 'Groceries.md', 'Attachments', async () => {
			try {
				await recordGif(session, scene, out, async () => {
					await sleep(800);
					const box = middleOf(await boundsOf(session, '.princelists-item .princelists-checkbox'));
					await tap(session, box.x, box.y);
					await sleep(900);
					const plus = middleOf(await boundsOf(session, '.princelists-new-item'));
					await tap(session, plus.x, plus.y);
					await sleep(600);
					await type(session, 'croissants');
					await sleep(300);
					const notes = await boundsOf(session, '.princelists-card .princelists-card-notes');
					await tap(session, notes.x + 60, notes.y + 20);
					await sleep(300);
					await type(session, '4, for Sunday breakfast');
					await sleep(700);
					// A tap on a heading while a card is open only closes the card.
					const produce = middleOf(await headingBounds(session, 'Produce'));
					await tap(session, produce.x, produce.y);
					await sleep(900);
					const title = await boundsOf(session, '.princelists-item-title', 'croissants');
					const from = { x: title.x + 30, y: title.y + title.height / 2 };
					const bakery = await headingBounds(session, 'Bakery');
					const to = { x: from.x, y: bakery.y + bakery.height * 0.75 };
					await fingerDown(session, from.x, from.y);
					await sleep(600);
					await fingerSlide(session, from, to, 900);
					await sleep(300);
					await fingerUp(session, to.x, to.y);
					await sleep(1500);
				});
			} finally {
				await sleep(SAVES_SETTLE_MS);
			}
		});
	},
};
export default scene;

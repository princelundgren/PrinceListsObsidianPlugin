// Draws macOS's close, minimize and zoom buttons on a desktop page, since macOS draws them outside
// the page, where CDP's screenshots and screencasts leave them out. shoot.mjs draws them for every
// desktop scene, and only a picture of the whole window shows them.

const ID = 'princelists-picture-window-buttons';
// As macOS 27 draws them for Obsidian 1.15, at the default accent colour: 14 px across, 23 px
// apart, from 14 px in and 12 px down.
const AT = { x: 14, y: 12 };
const SIZE = 14;
const PITCH = 23;
const COLOURS = [
	{ fill: '#ff5f57', edge: '#e0443e' },
	{ fill: '#febc2e', edge: '#dea123' },
	{ fill: '#28c840', edge: '#1aab29' },
];

/** Draws the window's buttons where macOS puts them for Obsidian, on a Mac, until `removeWindowButtons`. */
export async function drawWindowButtons(session) {
	await session.evaluate(`(() => {
		if (!document.body.classList.contains('mod-macos') || document.getElementById('${ID}')) return;
		const buttons = document.body.appendChild(document.createElement('div'));
		buttons.id = '${ID}';
		buttons.style.cssText = 'position: fixed; z-index: 2147483645; pointer-events: none; display: flex; gap: ${PITCH - SIZE}px;'
			+ 'left: ${AT.x}px; top: ${AT.y}px;';
		for (const { fill, edge } of ${JSON.stringify(COLOURS)}) {
			const button = buttons.appendChild(document.createElement('div'));
			button.style.cssText = 'box-sizing: border-box; width: ${SIZE}px; height: ${SIZE}px; border-radius: 50%;'
				+ 'background: ' + fill + '; border: 0.5px solid ' + edge + ';';
		}
	})()`);
}

/** Removes the buttons `drawWindowButtons` drew. */
export async function removeWindowButtons(session) {
	await session.evaluate(`document.getElementById('${ID}')?.remove()`);
}

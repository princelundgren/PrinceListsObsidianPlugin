// Lays a screenshot out under a caption, for the listing's shots. The layout is drawn over the page
// in the theme's colors and fonts, taken as a screenshot of its own, then removed.

const ID = 'princelists-picture-caption';

/**
 * Returns `png` (base64, as `Page.captureScreenshot` gives it) shrunk under `caption`, as a PNG at
 * the page's size, also base64. Throws if the picture doesn't load. The page is left as it was.
 */
export async function captioned(session, png, caption) {
	try {
		await session.evaluate(`new Promise((resolve, reject) => {
			const layout = document.body.appendChild(document.createElement('div'));
			layout.id = '${ID}';
			layout.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; box-sizing: border-box; display: flex;'
				+ 'flex-direction: column; align-items: center; padding: 0 5vw 5vh; background: var(--background-secondary);';
			const text = layout.appendChild(document.createElement('div'));
			text.textContent = ${JSON.stringify(caption)};
			text.style.cssText = 'flex: none; padding: 5vh 0 4vh; color: var(--text-normal); text-align: center; text-wrap: balance;'
				+ 'font: 600 min(5vh, 7.5vw) / 1.25 var(--font-interface);';
			const picture = layout.appendChild(document.createElement('img'));
			picture.style.cssText = 'flex: 1 1 0; min-height: 0; max-width: 100%; border-radius: min(1.5vh, 2vw);'
				+ 'box-shadow: 0 0 0 1px var(--background-modifier-border), 0 2vh 6vh rgb(0 0 0 / 0.45);';
			picture.onload = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
			picture.onerror = () => reject(new Error('The screenshot to caption did not load.'));
			picture.src = 'data:image/png;base64,${png}';
		})`);
		const { data } = await session.send('Page.captureScreenshot', { format: 'png' });
		return data;
	} finally {
		await session.evaluate(`document.getElementById('${ID}')?.remove()`);
	}
}

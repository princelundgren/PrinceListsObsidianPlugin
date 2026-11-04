// Takes the README's and the listing's pictures in a demo vault that Obsidian has open with a
// DevTools port. Usage is in AGENTS.md, under Commands.
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkDemoVault, connect } from './cdp.mjs';
import { sleep } from './page.mjs';
import { pointer } from './pointer.mjs';

const SCENES = new URL('./scenes/', import.meta.url);

/** Returns the URL of the scene module `name`, throwing when `scenes/` has none by that name. */
function sceneModule(name) {
	const module = new URL(`${name}.mjs`, SCENES);
	if (!/^[a-z0-9-]+$/.test(name) || !existsSync(module)) throw new Error(`There's no scene "${name}" in scripts/pictures/scenes/.`);
	return module;
}

async function shootScene(port, module, out) {
	const { default: scene } = await import(module);
	const session = await connect(port);
	try {
		await checkDemoVault(session, scene.theme);
		await session.send('Emulation.setDeviceMetricsOverride', {
			width: scene.page.width, height: scene.page.height, deviceScaleFactor: scene.scale, mobile: scene.phone,
		});
		// Hover states and tooltips need a focused page, and Obsidian may not be the front app.
		await session.send('Emulation.setFocusEmulationEnabled', { enabled: true });
		await sleep(500);
		await scene.setup(session);
		await scene.shoot(session, out);
	} finally {
		await pointer(session, 0, 0, 'hide').catch(() => {});
		await session.send('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {});
		await session.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
		session.close();
	}
}

/** Returns the names of the scenes in `scenes/` that aren't a phone's, in name order. */
export async function desktopSceneNames() {
	const names = (await readdir(SCENES)).filter((file) => file.endsWith('.mjs')).map((file) => file.slice(0, -'.mjs'.length)).sort();
	const scenes = await Promise.all(names.map(async (name) => ({ name, scene: (await import(sceneModule(name))).default })));
	return scenes.filter(({ scene }) => !scene.phone).map(({ name }) => name);
}

async function main() {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: { port: { type: 'string' }, out: { type: 'string' }, desktop: { type: 'boolean' } },
	});
	const namesScenes = positionals.length > 0;
	if (!values.port || !values.out || namesScenes === Boolean(values.desktop)) {
		throw new Error('Usage: node scripts/pictures/shoot.mjs --port <port> --out <folder> (<scene>... | --desktop)');
	}
	const port = Number(values.port);
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`The port is a number from 1 to 65535, not ${values.port}.`);
	const names = values.desktop ? await desktopSceneNames() : positionals;
	const scenes = names.map((name) => ({ name, module: sceneModule(name) }));
	await mkdir(values.out, { recursive: true });
	for (const { name, module } of scenes) {
		await shootScene(port, module, values.out);
		console.log(`Took ${name}.`);
	}
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}

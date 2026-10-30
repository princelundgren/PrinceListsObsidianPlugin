// Writes a copy of the demo vault, and the build, into the vault Obsidian has open on an Android
// emulator, through Obsidian's own file access. Usage is in AGENTS.md, under Commands.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { connect } from './cdp.mjs';
import { MARKER } from './demo-vault.mjs';

const BUILD = ['main.js', 'manifest.json', 'styles.css'];
const CONFIG = '.obsidian';
const REPOSITORY = fileURLToPath(new URL('../../', import.meta.url));

/** Returns every file in `folder`, each with its `/`-separated path inside it and its bytes in base64. */
export function filesToPush(folder) {
	return readdirSync(folder, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
		.map((file) => ({
			path: relative(folder, file).split(sep).join('/'),
			base64: readFileSync(file).toString('base64'),
		}));
}

/** Throws, naming the folder, unless it's a copy of the demo vault. */
export function checkCopy(folder) {
	if (!existsSync(join(folder, MARKER))) {
		throw new Error(`${folder} isn't a copy of the demo vault (it has no ${MARKER}). Make one with demo-vault.mjs.`);
	}
}

/**
 * Returns why the open vault, as the page describes it (`name`, `marker`: whether it holds the demo
 * marker, `configDir` and the paths of its `files`), can't take a push, or null when it can.
 */
export function pushProblem({ name, marker, configDir, files }) {
	if (marker || files.every((path) => path.startsWith(`${configDir}/`))) return null;
	return `The vault "${name}" holds notes and isn't a copy of the demo vault (it has no ${MARKER}), so nothing was done. Open a new vault in Obsidian.`;
}

/** Returns where `path` goes in a vault whose config folder is `configDir`, which needn't be `.obsidian`. */
export function vaultPath(path, configDir) {
	return path.startsWith(`${CONFIG}/`) ? `${configDir}${path.slice(CONFIG.length)}` : path;
}

const describeVault = (session) => session.evaluate(`(async () => {
	const { adapter, configDir } = app.vault;
	const files = [];
	const walk = async (folder) => {
		const listed = await adapter.list(folder);
		files.push(...listed.files);
		for (const inner of listed.folders) await walk(inner);
	};
	await walk('/');
	return { name: app.vault.getName(), marker: await adapter.exists(${JSON.stringify(MARKER)}), configDir, files };
})()`);

const removeEarlierFiles = (session) => session.evaluate(`(async () => {
	const { adapter, configDir } = app.vault;
	const clear = async (folder, kept) => {
		const { files, folders } = await adapter.list(folder);
		for (const file of files) if (!kept.includes(file)) await adapter.remove(file);
		for (const inner of folders) if (!kept.includes(inner)) await adapter.rmdir(inner, true);
	};
	await clear('/', [${JSON.stringify(MARKER)}, configDir]);
	await clear(configDir, [configDir + '/plugins']);
})()`);

const writeFile = (session, { path, base64 }) => session.evaluate(`(async () => {
	const { adapter } = app.vault;
	const path = ${JSON.stringify(path)};
	const folder = path.split('/').slice(0, -1).join('/');
	if (folder && !(await adapter.exists(folder))) await adapter.mkdir(folder);
	await adapter.writeBinary(path, Uint8Array.from(atob(${JSON.stringify(base64)}), (char) => char.charCodeAt(0)).buffer);
})()`);

function buildFiles() {
	return BUILD.map((name) => {
		const file = join(REPOSITORY, name);
		if (!existsSync(file)) throw new Error(`${file} is missing. Run npm run build first.`);
		return { path: `${CONFIG}/plugins/princelists/${name}`, base64: readFileSync(file).toString('base64') };
	});
}

async function pushVault(port, folder) {
	checkCopy(folder);
	const files = [...filesToPush(folder), ...buildFiles()];
	const session = await connect(port);
	try {
		const vault = await describeVault(session);
		const problem = pushProblem(vault);
		if (problem) throw new Error(problem);
		await removeEarlierFiles(session);
		for (const { path, base64 } of files) await writeFile(session, { path: vaultPath(path, vault.configDir), base64 });
	} finally {
		session.close();
	}
	return files.length;
}

async function main() {
	const { values, positionals } = parseArgs({ allowPositionals: true, options: { port: { type: 'string' } } });
	if (!values.port || positionals.length !== 1) throw new Error('Usage: node scripts/pictures/push-vault.mjs --port <port> <folder>');
	const count = await pushVault(Number(values.port), positionals[0]);
	console.log(`Pushed ${count} files. Stop Obsidian and start it again, so it reads them (AGENTS.md).`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}

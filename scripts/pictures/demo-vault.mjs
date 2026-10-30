// Copies the demo vault in demo/vault/ to a folder, moving its dates to today. Usage is in
// AGENTS.md, under Commands.
import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** The day the demo vault's dates were written for: a copy made on it changes no date. */
export const ANCHOR_DAY = '2026-10-28';
export const MARKER = '.princelists-demo';
const CONFIG = '.obsidian';
const SOURCE = fileURLToPath(new URL('../../demo/vault/', import.meta.url));
export const THEMES = { dark: 'obsidian', light: 'moonstone' };
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const USAGE = 'Usage: node scripts/pictures/demo-vault.mjs <folder> [--theme dark|light] [--today YYYY-MM-DD]';

const utcOf = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const isDay = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text) && new Date(utcOf(text)).toISOString().slice(0, 10) === text;

/** Returns the text with every `YYYY-MM-DD` in it moved by `days` calendar days, and nothing else changed. */
export function shiftDates(text, days) {
	return text.replace(DATE, (_, year, month, day) =>
		new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days)).toISOString().slice(0, 10));
}

/**
 * Throws, naming the folder, unless it's missing, holds nothing outside `.obsidian/`, or is an
 * earlier copy. A linked `.obsidian/` is refused too, since it may be another vault's.
 */
export function checkTarget(folder) {
	if (!existsSync(folder)) return;
	if (!statSync(folder).isDirectory()) throw new Error(`${folder} isn't a folder. Give a folder for the copy.`);
	const config = join(folder, CONFIG);
	if (lstatSync(config, { throwIfNoEntry: false })?.isSymbolicLink()) {
		throw new Error(`${config} is a link, which may lead to another vault's settings. Give a folder of its own.`);
	}
	if (existsSync(join(folder, MARKER))) return;
	if (readdirSync(folder).some((name) => name !== CONFIG)) {
		throw new Error(`${folder} holds files and isn't a copy of the demo vault (it has no ${MARKER}). Give an empty folder or a new vault.`);
	}
}

/**
 * Writes the demo vault into `folder` with its dates moved from ANCHOR_DAY to `today` (`YYYY-MM-DD`)
 * and the theme `dark` or `light`. It first checks the folder. Over an earlier copy it deletes
 * everything but the marker and `.obsidian/plugins/`; in a new vault it only adds and overwrites the
 * files the demo vault ships. Throws on a bad folder, day or theme.
 */
export function copyDemoVault(folder, { theme, today }) {
	if (!Object.hasOwn(THEMES, theme)) throw new Error(`The theme is dark or light, not ${theme}.`);
	if (!isDay(today)) throw new Error(`${today} isn't a day in the form YYYY-MM-DD.`);
	checkTarget(folder);
	try {
		removeEarlierCopy(folder);
		writeCopy(folder, { theme, today });
	} catch (error) {
		throw new Error(`The copy into ${folder} stopped partway: ${error.message}. Close the vault in Obsidian and run the script again to finish it.`, { cause: error });
	}
}

function writeCopy(folder, { theme, today }) {
	const days = Math.round((utcOf(today) - utcOf(ANCHOR_DAY)) / DAY_MS);
	cpSync(SOURCE, folder, { recursive: true });
	for (const path of markdownFiles(folder)) writeFileSync(path, shiftDates(readFileSync(path, 'utf8'), days));
	const appearancePath = join(folder, CONFIG, 'appearance.json');
	const appearance = JSON.parse(readFileSync(appearancePath, 'utf8'));
	writeFileSync(appearancePath, `${JSON.stringify({ ...appearance, theme: THEMES[theme] }, null, 2)}\n`);
	writeFileSync(join(folder, MARKER), '');
}

function removeEarlierCopy(folder) {
	if (!existsSync(join(folder, MARKER))) return;
	for (const name of readdirSync(folder)) {
		if (name !== CONFIG && name !== MARKER) rmSync(join(folder, name), { recursive: true, force: true });
	}
	const config = join(folder, CONFIG);
	if (!existsSync(config)) return;
	for (const name of readdirSync(config)) {
		if (name !== 'plugins') rmSync(join(config, name), { recursive: true, force: true });
	}
}

function markdownFiles(folder) {
	return readdirSync(folder, { recursive: true })
		.filter((path) => path.endsWith('.md') && path.split(sep)[0] !== CONFIG)
		.map((path) => join(folder, path));
}

function localDay() {
	const now = new Date();
	return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, '0')).join('-');
}

function main() {
	try {
		const { values, positionals } = parseArgs({
			allowPositionals: true,
			options: { theme: { type: 'string', default: 'dark' }, today: { type: 'string', default: localDay() } },
		});
		if (positionals.length !== 1) throw new Error(USAGE);
		const [folder] = positionals;
		copyDemoVault(folder, { theme: values.theme, today: values.today });
		console.log(`Copied the demo vault to ${folder}, its dates moved to ${values.today}. Close the vault in Obsidian before copying again.`);
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}

// Through a linked path, argv[1] keeps the link while import.meta.url resolves it.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();

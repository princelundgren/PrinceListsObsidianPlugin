// Encodes the scenes' PNGs: stills as lossless WebP, recordings as GIFs.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ffmpeg's GIFs tick at 25 frames a second, and it drops frames that land on the same tick.
const SHORTEST_FRAME_MS = 40;

function run(tool, args) {
	try {
		execFileSync(tool, args, { stdio: ['ignore', 'ignore', 'pipe'] });
	} catch (error) {
		if (error.code === 'ENOENT') throw new Error(`${tool} isn't installed, and the pictures need it.`);
		throw new Error(`${tool} failed: ${error.stderr?.toString().trim() || error.message}`);
	}
}

/** Writes the PNG `png` to `out` as lossless WebP, keeping no metadata. */
export function toWebp(png, out) {
	run('cwebp', ['-quiet', '-lossless', '-z', '9', png, '-o', out]);
}

/**
 * Returns the frames with any shorter than `shortestMs` joined into the next, which keeps its
 * picture and takes their time. The last frame stays, however short.
 */
export function mergeShortFrames(frames, shortestMs) {
	const merged = [];
	let carriedMs = 0;
	frames.forEach(({ file, ms }, index) => {
		const lastingMs = carriedMs + ms;
		if (lastingMs < shortestMs && index < frames.length - 1) {
			carriedMs = lastingMs;
			return;
		}
		merged.push({ file, ms: lastingMs });
		carriedMs = 0;
	});
	return merged;
}

/**
 * Returns the ffmpeg filter that cuts a frame of the `screen` down to the `clip`, a part of the page
 * in CSS pixels, at the clip's size in pixels. Without a clip it keeps the whole `page`, in the
 * screen's top left corner. Android ignores the page's size in what it sends.
 */
export function pageFilter(page, screen, clip = { x: 0, y: 0, ...page }) {
	const [x, y, width, height] = [clip.x, clip.y, clip.width, clip.height].map(Math.round);
	const across = (n) => `iw*${n / screen.width}`;
	const down = (n) => `ih*${n / screen.height}`;
	return `crop=${across(width)}:${down(height)}:${across(x)}:${down(y)},scale=${width}:${height}:flags=lanczos`;
}

/**
 * Writes the PNG frames of the `screen` to `out` as a looping GIF of the `clip`, or of the whole
 * `page` without one, with one palette, each frame shown for its `ms`. A frame too short for a
 * GIF's tick is dropped, and the next one takes its time.
 */
export function toGif(frames, out, page, screen, clip) {
	const folder = mkdtempSync(join(tmpdir(), 'princelists-gif-'));
	try {
		const list = join(folder, 'frames.txt');
		const lines = mergeShortFrames(frames, SHORTEST_FRAME_MS).flatMap(({ file, ms }) => [`file '${file.replaceAll("'", "'\\''")}'`, `duration ${ms / 1000}`]);
		// The concat demuxer ignores the last frame's duration unless that frame is listed again.
		writeFileSync(list, `${[...lines, lines.at(-2)].join('\n')}\n`);
		run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
			'-vf', `${pageFilter(page, screen, clip)},split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none`, '-fps_mode', 'vfr', '-loop', '0', out]);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

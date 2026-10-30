// Encodes the scenes' PNGs for the README: stills as lossless WebP, recordings as GIFs.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
 * Writes the PNG frames to `out` as a looping GIF with one palette, each frame shown for its `ms`.
 */
export function toGif(frames, out) {
	const folder = mkdtempSync(join(tmpdir(), 'princelists-gif-'));
	try {
		const list = join(folder, 'frames.txt');
		const lines = frames.flatMap(({ file, ms }) => [`file '${file.replaceAll("'", "'\\''")}'`, `duration ${ms / 1000}`]);
		// The concat demuxer ignores the last frame's duration unless that frame is listed again.
		writeFileSync(list, `${[...lines, lines.at(-2)].join('\n')}\n`);
		run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
			'-vf', 'split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none', '-fps_mode', 'vfr', '-loop', '0', out]);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

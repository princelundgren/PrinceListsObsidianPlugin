// Runs the docs check on the repo it's started in, and on a pull request's title and description
// when they're given. Usage is in AGENTS.md, under Commands.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path/posix';
import { parseArgs } from 'node:util';
import { checkLinks, checkPullRequestBody, checkPullRequestTitle, checkRawLinks, checkText } from './docs-checks.mjs';

const { values } = parseArgs({
	options: { 'pr-title': { type: 'string' }, 'pr-body-file': { type: 'string' } },
});

const isCheckedText = (path) => !path.startsWith('tests/fixtures/')
	&& (path.endsWith('.md') || (path.startsWith('.github/') && /\.ya?ml$/.test(path)));

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const root = git('rev-parse', '--show-toplevel').trim();
// Untracked files count too, so a local run sees new files before they're added. Deleted ones don't.
const files = git('-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')
	.split('\0')
	.filter((path) => path && existsSync(join(root, path)));
const texts = new Map(files.filter(isCheckedText).map((path) => [path, readFileSync(join(root, path), 'utf8')]));
const docs = new Map([...texts].filter(([path]) => path.endsWith('.md')));

const findings = [...texts].flatMap(([path, text]) => checkText(text, path));
const fileSet = new Set(files);
findings.push(...checkLinks(docs, fileSet), ...checkRawLinks(docs, fileSet));
findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
const prText = [];
if (values['pr-title'] !== undefined) {
	prText.push('title');
	findings.push(...checkPullRequestTitle(values['pr-title']));
}
if (values['pr-body-file'] !== undefined) {
	prText.push('description');
	findings.push(...checkPullRequestBody(readFileSync(values['pr-body-file'], 'utf8')));
}

for (const { path, line, message } of findings) {
	console.log(`${path}:${line}: ${message}`);
}
if (findings.length > 0) {
	console.log(`${findings.length} problem${findings.length === 1 ? '' : 's'} found.`);
	process.exitCode = 1;
} else {
	const prNote = prText.length > 0 ? `, and the pull request ${prText.join(' and ')}` : '';
	console.log(`Docs check passed: ${texts.size} files${prNote}.`);
}

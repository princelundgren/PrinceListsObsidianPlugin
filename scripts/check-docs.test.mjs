// Runs with `node --test`. Plan Task 1's `vitest run --dir tests` keeps vitest from collecting it.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
	checkLinks,
	checkPullRequestBody,
	checkPullRequestTitle,
	checkRawLinks,
	checkText,
	headingAnchors,
	PR_PARTS,
} from './docs-checks.mjs';

const CLI = fileURLToPath(new URL('check-docs.mjs', import.meta.url));
const TEMPLATE = readFileSync(new URL('../.github/pull_request_template.md', import.meta.url), 'utf8');
const lines = (findings) => findings.map(({ path, line, message }) => `${path}:${line}: ${message}`);

test('flags British spellings as whole words in any case', () => {
	assert.deepEqual(lines(checkText('The Behaviour is\nnormalised, whilst re-serialise and GREY.', 'a.md')), [
		'a.md:1: British spelling "Behaviour": use "behavior"',
		'a.md:2: British spelling "normalised": use "normalized"',
		'a.md:2: British spelling "whilst": use "while"',
		'a.md:2: British spelling "serialise": use "serialize"',
		'a.md:2: British spelling "GREY": use "gray"',
	]);
	assert.deepEqual(lines(checkText('customisable, sanitised, specialisation, emphasises', 'a.md')), [
		'a.md:1: British spelling "customisable": use "customizable"',
		'a.md:1: British spelling "sanitised": use "sanitized"',
		'a.md:1: British spelling "specialisation": use "specialization"',
		'a.md:1: British spelling "emphasises": use "emphasizes"',
	]);
});

test('leaves American words and lookalikes alone, and keeps "tick"', () => {
	const text = 'Tick and ticked items; analyses, promise, otherwise, raise, advise, hour, four, '
		+ 'greyhound, colors, normalize, canceled, license, catalog, flat, dialogue, emphasis.';
	assert.deepEqual(checkText(text, 'a.md'), []);
});

test('skips code and URLs for spelling, but not for letters and paths', () => {
	const text = [
		'Run `grep -w colour`, see [docs](https://example.com/colour) or <https://example.com/grey>,',
		'[notes](colour-notes.md), <mailto:grey@example.com> and https://example.com/behaviour. gre`x`y',
		'```',
		'grey /Users/someone ä',
		'```',
	].join('\n');
	assert.deepEqual(lines(checkText(text, 'a.md')), [
		'a.md:4: non-English letter "ä"',
		'a.md:4: local path "/Users/someone"',
	]);
});

test('flags the letters å, ä and ö, composed or not', () => {
	assert.deepEqual(lines(checkText('Ö and a\u030A', 'a.md')), [
		'a.md:1: non-English letter "Ö"',
		'a.md:1: non-English letter "å"',
	]);
});

test('flags local paths but not URL paths or the CI runner\'s home', () => {
	const text = [
		'See /Users/someone/vault',
		'`/home/someone/x`',
		'C:\\Users\\someone, c:\\users\\someone and file:///D:/Users/someone',
		'https://example.com/home/page',
		'/home/runner/work/x and /home/runners',
	].join('\n');
	assert.deepEqual(lines(checkText(text, 'a.md')), [
		'a.md:1: local path "/Users/someone"',
		'a.md:2: local path "/home/someone"',
		'a.md:3: local path "C:\\Users\\"',
		'a.md:3: local path "c:\\users\\"',
		'a.md:3: local path "D:/Users/"',
		'a.md:5: local path "/home/runners"',
	]);
});

test('makes heading anchors the way GitHub does', () => {
	const markdown = [
		'---',
		'# not: a heading',
		'---',
		'## Rules that are never broken',
		'## Where `✔` goes',
		"### This'll be a _Helpful_ Section, isn't it?",
		'## Use [the plan](plan.md) ##',
		'## my_name',
		'## Commands',
		'## Commands',
		'```',
		'## Commands',
		'```',
		'## Commands',
	].join('\n');
	assert.deepEqual([...headingAnchors(markdown)], [
		'rules-that-are-never-broken',
		'where--goes',
		'thisll-be-a-helpful-section-isnt-it',
		'use-the-plan',
		'my_name',
		'commands',
		'commands-1',
		'commands-2',
	]);
});

test('finds fenced code the way CommonMark does, with indented fences too', () => {
	const text = [
		'1. A step:',
		'    ~~~~',
		'    grey 1',
		'    `````',
		'    grey 2',
		'    ~~~',
		'    grey 3',
		'    ~~~~ not a closer',
		'    grey 4',
		'    ~~~~',
		'```grey``` is a code span, not a fence',
		'grey 5',
	].join('\n');
	assert.deepEqual(lines(checkText(text, 'a.md')), ['a.md:12: British spelling "grey": use "gray"']);
});

test('reads front matter and headings with CRLF line endings', () => {
	assert.deepEqual([...headingAnchors('---\r\n# no\r\n---\r\n## A\r\n## A\r\n')], ['a', 'a-1']);
});

test('reports missing files and headings, and passes good links', () => {
	const docs = new Map([
		['README.md', [
			'[ok](AGENTS.md#commands) [ok](LICENSE#L1) [ok](docs/) [ok](./) [ok](.) [ok](#intro)',
			'[ok](AGENTS.md "The rules") [ok](<AGENTS.md>) [ok](AGENTS.md?plain=1#commands)',
			'[ok](My%20notes.md#caf%C3%A9) [ok](/docs/guide.md) [web](https://example.com/x.md)',
			"[missing](NOPE.md) [bad anchor](AGENTS.md#rules 'title') [bad local](#outro)",
			'[root](/NOPE.md) [bad encoding](x%E0%A4%A.md) `[in code](NOPE.md)`',
			'## Intro',
		].join('\r\n')],
		['AGENTS.md', '## Commands\n'],
		['My notes.md', '## Café\n'],
		['docs/guide.md', '[up](../README.md#intro) [up](../agents.md) [root](/) [root](/AGENTS.md)'],
	]);
	const files = new Set(['README.md', 'AGENTS.md', 'LICENSE', 'My notes.md', 'docs/guide.md']);
	assert.deepEqual(lines(checkLinks(docs, files)), [
		'README.md:4: broken link "NOPE.md": no file NOPE.md',
		'README.md:4: broken link "AGENTS.md#rules": no heading #rules in AGENTS.md',
		'README.md:4: broken link "#outro": no heading #outro in README.md',
		'README.md:5: broken link "/NOPE.md": no file NOPE.md',
		'README.md:5: broken link "x%E0%A4%A.md": bad percent-encoding',
		'docs/guide.md:1: broken link "../agents.md": no file agents.md',
	]);
});

test('reports a raw link to this repo\'s main whose file is missing, in Markdown or HTML', () => {
	const raw = 'https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin';
	const upperRaw = raw.replace('princelundgren', 'PrinceLundgren');
	const docs = new Map([
		['README.md', [
			`![ok](${raw}/main/docs/a.gif?raw=true#x) <img src="${raw}/refs/heads/main/docs/b.webp" width="200">`,
			`![gone](${raw}/main/docs/old.png) | <img src="${raw}/main/docs/c.webp"> |`,
			`![ok](${upperRaw}/main/docs/my%20pic.png) ![bad](${raw}/main/x%E0%A4%A.png)`,
			`![other branch](${raw}/a-branch/NOPE.png) ![other repo](https://raw.githubusercontent.com/someone/else/main/x.png)`,
			`![not main](${raw}/Main/NOPE.png) See ${raw}/main/docs/a.gif, then ${raw}/main/README.md.`,
			`\`${raw}/main/NOPE.md\``,
			'```',
			`${raw}/main/IN-A-FENCE.md`,
			'```',
		].join('\n')],
	]);
	const files = new Set(['README.md', 'docs/a.gif', 'docs/b.webp', 'docs/my pic.png']);
	assert.deepEqual(lines(checkRawLinks(docs, files)), [
		`README.md:2: broken link "${raw}/main/docs/old.png": no file docs/old.png`,
		`README.md:2: broken link "${raw}/main/docs/c.webp": no file docs/c.webp`,
		`README.md:3: broken link "${raw}/main/x%E0%A4%A.png": bad percent-encoding`,
	]);
});

test('the command checks the files of the repo it runs in, and exits 1 on a problem', (t) => {
	const repo = mkdtempSync(join(tmpdir(), 'check-docs-'));
	t.after(() => rmSync(repo, { recursive: true, force: true }));
	execFileSync('git', ['init', '-q'], { cwd: repo });
	const write = (path, text) => {
		mkdirSync(dirname(join(repo, path)), { recursive: true });
		writeFileSync(join(repo, path), text);
	};
	write('README.md', 'Grey [rules](AGENTS.md)\n');
	write('AGENTS.md', '# Rules\n');
	write('.github/workflows/ci.yml', 'name: grey\n');
	write('tests/fixtures/list.md', '- [ ] grey [x](nope.md)\n');
	write('notes.txt', 'grey\n');
	write('config.yml', 'name: grey\n');
	write('ignored.md', 'grey\n');
	write('.gitignore', 'ignored.md\n');
	write('deleted.md', 'grey\n');
	execFileSync('git', ['add', 'deleted.md'], { cwd: repo });
	rmSync(join(repo, 'deleted.md'));

	const failing = spawnSync(process.execPath, [CLI], { cwd: join(repo, '.github'), encoding: 'utf8' });
	assert.equal(failing.status, 1);
	assert.deepEqual(failing.stdout.trim().split('\n'), [
		'.github/workflows/ci.yml:1: British spelling "grey": use "gray"',
		'README.md:1: British spelling "Grey": use "gray"',
		'2 problems found.',
	]);

	write('README.md', 'Gray [rules](AGENTS.md)\n');
	rmSync(join(repo, '.github'), { recursive: true });
	const passing = spawnSync(process.execPath, [CLI], { cwd: repo, encoding: 'utf8' });
	assert.equal(passing.status, 0);
	assert.equal(passing.stdout.trim(), 'Docs check passed: 2 files.');
});

const body = (parts) => PR_PARTS.map((part, i) => `## ${part}\n\n${parts[i]}\n`).join('\n');
const goodParts = ['Adds a check.', 'Reviews kept finding it.', 'Ran the tests.', '1. Run it.', 'None'];

test('expects the parts the pull request template has', () => {
	assert.deepEqual(TEMPLATE.match(/^## .*/gm).map((heading) => heading.slice(3)), PR_PARTS);
	assert.deepEqual(lines(checkPullRequestBody(TEMPLATE)), [
		'PR body:1: the "## What does this PR do?" part is empty',
		'PR body:5: the "## Why is this change needed?" part is empty',
		'PR body:9: the "## How was this tested?" part is empty',
		'PR body:13: the "## Steps to reproduce" part is empty',
		'PR body:17: the "## Related tickets and links" part is empty',
	]);
});

test('passes a filled-in description, with CRLF line endings too', () => {
	assert.deepEqual(checkPullRequestBody(body(goodParts)), []);
	assert.deepEqual(checkPullRequestBody(body(goodParts).replace(/\n/g, '\r\n')), []);
	const subheading = [...goodParts];
	subheading[0] = '### The check\n\nAdds it.';
	assert.deepEqual(checkPullRequestBody(body(subheading).replace('## Steps to reproduce', '$& ')), []);
});

test('reports a missing or out-of-order part', () => {
	const renamed = body(goodParts).replace('## Steps to reproduce', '## Steps');
	assert.deepEqual(lines(checkPullRequestBody(renamed)), [
		'PR body:1: the "## Steps to reproduce" part is missing or out of order',
	]);
	const [what, why] = PR_PARTS.slice(0, 2).map((part) => `## ${part}`);
	const swapped = body(goodParts).replace(what, '#').replace(why, what).replace('#', why);
	assert.deepEqual(lines(checkPullRequestBody(swapped)), [
		'PR body:1: the "## Why is this change needed?" part is missing or out of order',
	]);
});

test('reports a part that holds only a comment, and hides what an unclosed one covers', () => {
	const commented = [...goodParts];
	commented[2] = '<!-- Each command you ran\nand its result. -->';
	commented[3] = '';
	assert.deepEqual(lines(checkPullRequestBody(body(commented))), [
		'PR body:9: the "## How was this tested?" part is empty',
		'PR body:14: the "## Steps to reproduce" part is empty',
	]);
	const unclosed = [...goodParts];
	unclosed[3] = '<!-- Steps a reviewer can follow';
	assert.deepEqual(lines(checkPullRequestBody(body(unclosed))), [
		'PR body:1: the "## Related tickets and links" part is missing or out of order',
		'PR body:13: the "## Steps to reproduce" part is empty',
	]);
});

test('reads a comment opener inside a code span as text', () => {
	const parts = [...goodParts];
	parts[0] = 'Strips each `<!--` comment.';
	assert.deepEqual(checkPullRequestBody(body(parts)), []);
});

test('allows 400 words, not counting comments, and no more', () => {
	const words = body(goodParts).split(/\s+/).filter(Boolean).length;
	const atLimit = [...goodParts];
	atLimit[0] += ' word'.repeat(400 - words) + ' <!-- not counted -->';
	assert.deepEqual(checkPullRequestBody(body(atLimit)), []);
	const overLimit = [...atLimit];
	overLimit[0] += ' word';
	assert.deepEqual(lines(checkPullRequestBody(body(overLimit))), ['PR body:1: 401 words; the limit is 400']);
});

test('checks the title and body text like the docs', () => {
	assert.deepEqual(lines(checkPullRequestTitle('Tidy the colour handling')), [
		'PR title:1: British spelling "colour": use "color"',
	]);
	const parts = [...goodParts];
	parts[4] = 'See /Users/someone/notes';
	assert.deepEqual(lines(checkPullRequestBody(body(parts))), [
		'PR body:19: local path "/Users/someone"',
	]);
});

test('the command checks a title that starts with "-" and a description file', (t) => {
	const repo = mkdtempSync(join(tmpdir(), 'check-docs-'));
	t.after(() => rmSync(repo, { recursive: true, force: true }));
	execFileSync('git', ['init', '-q'], { cwd: repo });
	writeFileSync(join(repo, 'README.md'), 'Gray\n');
	writeFileSync(join(repo, 'AGENTS.md'), 'Gray\n');
	writeFileSync(join(repo, 'body.txt'), body(goodParts).replace('## Steps to reproduce', '## Steps'));
	const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: repo, encoding: 'utf8' });

	const failing = run('--pr-title=-Tidy the colour handling', '--pr-body-file', 'body.txt');
	assert.equal(failing.status, 1);
	assert.deepEqual(failing.stdout.trim().split('\n'), [
		'PR title:1: British spelling "colour": use "color"',
		'PR body:1: the "## Steps to reproduce" part is missing or out of order',
		'2 problems found.',
	]);

	writeFileSync(join(repo, 'body.txt'), body(goodParts));
	const passing = run('--pr-title=-Tidy the color handling', '--pr-body-file', 'body.txt');
	assert.equal(passing.status, 0);
	assert.equal(passing.stdout.trim(), 'Docs check passed: 2 files, and the pull request title and description.');

	const mistyped = run('--pr-body', 'body.txt');
	assert.equal(mistyped.status, 1);
	assert.match(mistyped.stderr, /ERR_PARSE_ARGS_UNKNOWN_OPTION/);
});

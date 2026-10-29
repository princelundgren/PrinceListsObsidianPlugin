// The docs check's rules, as pure functions. check-docs.mjs runs them on the repo and on pull
// request text.
import { dirname, join, normalize } from 'node:path/posix';

const BRITISH = new Map(`
	behaviour behavior, behaviours behaviors, behavioural behavioral,
	colour color, colours colors, coloured colored, colouring coloring, colourful colorful,
	favour favor, favours favors, favoured favored, favourite favorite, favourites favorites,
	favourable favorable, honour honor, honours honors, honoured honored,
	neighbour neighbor, neighbours neighbors, neighbouring neighboring, neighbourhood neighborhood,
	flavour flavor, flavours flavors, humour humor, labour labor, rumour rumor,
	endeavour endeavor, endeavours endeavors,
	centre center, centres centers, centred centered, metre meter, metres meters,
	litre liter, litres liters, theatre theater, fibre fiber,
	licence license, licences licenses, defence defense, defences defenses,
	offence offense, offences offenses,
	catalogue catalog, catalogues catalogs, catalogued cataloged,
	analyse analyze, analysed analyzed, analysing analyzing,
	travelled traveled, travelling traveling, traveller traveler, travellers travelers,
	cancelled canceled, cancelling canceling, labelled labeled, labelling labeling,
	modelled modeled, modelling modeling, signalled signaled, signalling signaling,
	levelled leveled, levelling leveling,
	grey gray, greys grays, greyed grayed, greying graying, greyish grayish,
	whilst while, amongst among, programme program, programmes programs,
	judgement judgment, judgements judgments, ageing aging, artefact artifact, artefacts artifacts,
	learnt learned, fulfil fulfill, fulfils fulfills, fulfilment fulfillment,
	enrol enroll, enrolment enrollment, skilful skillful,
	practise practice, practised practiced, practising practicing,
	focussed focused, focussing focusing, speciality specialty, orientated oriented
`.trim().split(/,\s*/).map((pair) => pair.split(' ')));

// Stems of -ise verbs. Only the stem plus an ending is listed, so "emphasis" itself stays allowed.
for (const stem of [
	'organis', 'recognis', 'realis', 'normalis', 'serialis', 'deserialis', 'initialis', 'summaris',
	'prioritis', 'customis', 'optimis', 'utilis', 'authoris', 'categoris', 'finalis', 'minimis',
	'maximis', 'standardis', 'synchronis', 'visualis', 'localis', 'apologis', 'capitalis', 'memoris',
	'sanitis', 'specialis', 'emphasis',
]) {
	for (const ending of ['e', 'ed', 'es', 'ing', 'er', 'ers', 'ation', 'ations', 'able']) {
		BRITISH.set(stem + ending, stem.slice(0, -1) + 'z' + ending);
	}
}

// Not \b, which knows only ASCII letters and would end a word at a letter like é.
const WORD = (alternatives) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'giu');

const LINE_BREAK = /\r\n|\r|\n/;
// A space, not '', so the text on either side of a span doesn't join into one word.
const withoutCodeSpans = (line) => line.replace(/(`+).*?\1/g, ' ');
// A URL can't be respelled.
const withoutUrls = (line) => line
	.replace(/\]\([^)]*\)/g, '] ')
	.replace(/<[a-z][a-z\d+.-]*:[^\s>]*>/gi, ' ')
	.replace(/https?:\/\/\S+/g, ' ');

const TEXT_RULES = [
	{
		// Prose only: code may quote a British spelling on purpose, as a search for it does.
		proseOnly: true,
		pattern: WORD([...BRITISH.keys()].join('|')),
		message: (match) => `British spelling "${match}": use "${BRITISH.get(match.toLowerCase())}"`,
	},
	{ pattern: /[åäöÅÄÖ]/gu, message: (match) => `non-English letter "${match}"` },
	{
		// The lookbehind lets URL paths such as example.com/home/ through, and leaves D:/Users/ to
		// the Windows rule. /home/runner/ is the GitHub Actions runner's home, which pasted CI logs
		// show.
		pattern: /(?<![\w.:-])(?:\/Users\/[\w.-]+|\/home\/(?!runner(?![\w.-]))[\w.-]+)/g,
		message: (match) => `local path "${match}"`,
	},
	// Windows ignores case in paths, and takes either slash.
	{ pattern: /(?<![\w.-])[a-z]:[\\/]users[\\/]/gi, message: (match) => `local path "${match}"` },
];

const finding = (path, line, message) => ({ path, line, message });

export function checkText(text, path) {
	const findings = [];
	const prose = new Map(proseLines(text));
	text.split(LINE_BREAK).forEach((line, index) => {
		for (const { proseOnly, pattern, message } of TEXT_RULES) {
			const scanned = proseOnly ? withoutUrls(withoutCodeSpans(prose.get(index) ?? '')) : line;
			// NFC, so a letter typed as a base letter plus a combining mark is caught too.
			for (const [match] of scanned.normalize('NFC').matchAll(pattern)) {
				findings.push(finding(path, index + 1, message(match)));
			}
		}
	});
	return findings;
}

// Yields [lineIndex, line] for each line outside front matter and fenced code blocks. Fences
// follow CommonMark, except that an opener may be indented any amount, as in a list item.
function* proseLines(markdown) {
	const lines = markdown.split(LINE_BREAK);
	let index = 0;
	if (lines[0] === '---') {
		index = lines.indexOf('---', 1) + 1;
	}
	let fence = null;
	for (; index < lines.length; index++) {
		const line = lines[index];
		if (fence) {
			const closer = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
			if (closer && closer[0] === fence[0] && closer.length >= fence.length) {
				fence = null;
			}
			continue;
		}
		const opener = /^[ \t]*(?:(`{3,})[^`]*|(~{3,}).*)$/.exec(line);
		if (opener) {
			fence = opener[1] ?? opener[2];
		} else {
			yield [index, line];
		}
	}
}

// GitHub's rule, as github-slugger implements it: strip the markup, lowercase, drop everything but
// letters, marks, digits, underscores, hyphens and spaces, then turn each space into a hyphen.
export function headingSlug(heading) {
	return heading
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]*>/g, '')
		.replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, '')
		.trim()
		.toLowerCase()
		.replace(/[^\p{Alphabetic}\p{M}\p{Nd}\p{Pc}\- ]/gu, '')
		.replace(/ /g, '-');
}

export function headingAnchors(markdown) {
	const counts = new Map();
	const anchors = new Set();
	for (const [, line] of proseLines(markdown)) {
		const heading = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(line);
		if (!heading) {
			continue;
		}
		const base = headingSlug(heading[1] ?? '');
		let anchor = base;
		while (counts.has(anchor)) {
			counts.set(base, counts.get(base) + 1);
			anchor = `${base}-${counts.get(base)}`;
		}
		counts.set(anchor, 0);
		anchors.add(anchor);
	}
	return anchors;
}

// The link's target path from the repo root, and its fragment, or null when it has none.
function resolveLink(from, rawTarget) {
	const hashAt = rawTarget.indexOf('#');
	const pathPart = (hashAt === -1 ? rawTarget : rawTarget.slice(0, hashAt)).replace(/\?.*/, '');
	const fragment = hashAt === -1 ? null : decodeURIComponent(rawTarget.slice(hashAt + 1));
	const decoded = decodeURIComponent(pathPart);
	if (decoded === '') {
		return { target: from, fragment };
	}
	const joined = decoded.startsWith('/') ? decoded.slice(1) || '.' : join(dirname(from), decoded);
	return { target: normalize(joined).replace(/(.)\/$/, '$1'), fragment };
}

// docs maps each checked Markdown path to its text; files holds every path in the repo.
export function checkLinks(docs, files) {
	const findings = [];
	const anchorCache = new Map();
	const anchorsOf = (path) => {
		if (!anchorCache.has(path)) {
			anchorCache.set(path, headingAnchors(docs.get(path)));
		}
		return anchorCache.get(path);
	};
	const exists = (path) => path === '.' || files.has(path) || [...files].some((p) => p.startsWith(`${path}/`));

	for (const [path, text] of docs) {
		for (const [index, line] of proseLines(text)) {
			const links = withoutCodeSpans(line).matchAll(/\]\(\s*<?([^\s<>)]*)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g);
			for (const [, rawTarget] of links) {
				if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(rawTarget)) {
					continue;
				}
				const report = (problem) => findings.push(finding(path, index + 1, `broken link "${rawTarget}": ${problem}`));
				let link;
				try {
					link = resolveLink(path, rawTarget);
				} catch (error) {
					if (!(error instanceof URIError)) {
						throw error;
					}
					report('bad percent-encoding');
					continue;
				}
				const { target, fragment } = link;
				if (!exists(target)) {
					report(`no file ${target}`);
				} else if (fragment && docs.has(target) && !anchorsOf(target).has(fragment)) {
					report(`no heading #${fragment} in ${target}`);
				}
			}
		}
	}
	return findings;
}

const RAW_LINK = /https:\/\/raw\.githubusercontent\.com\/princelundgren\/PrinceListsObsidianPlugin\/[^/\s]+\/([^\s"'<>)]+)/g;

// checkLinks skips URLs, but the README links its pictures by full raw URL for Obsidian's plugin browser.
export function checkRawLinks(docs, files) {
	const findings = [];
	for (const [path, text] of docs) {
		for (const [index, line] of proseLines(text)) {
			for (const [url, target] of withoutCodeSpans(line).matchAll(RAW_LINK)) {
				if (!files.has(target)) {
					findings.push(finding(path, index + 1, `broken link "${url}": no file ${target}`));
				}
			}
		}
	}
	return findings;
}

export const PR_PARTS = [
	'What does this PR do?',
	'Why is this change needed?',
	'How was this tested?',
	'Steps to reproduce',
	'Related tickets and links',
];
const MAX_PR_WORDS = 400;

// Removes comments but keeps a code span whole, so a <!-- inside one, which GitHub shows as text,
// hides nothing and its words still count. An unclosed comment runs to the end, as in HTML.
// Newlines stay, so line numbers still hold.
const withoutComments = (text) => text.replace(
	/(`+)[^\r\n]*?\1|<!--[\s\S]*?(?:-->|$)/g,
	(match, ticks) => ticks ? match : match.replace(/[^\r\n]/g, ''),
);

export function checkPullRequestTitle(title) {
	return checkText(title, 'PR title');
}

export function checkPullRequestBody(body) {
	const findings = checkText(body, 'PR body');
	const lines = withoutComments(body).split(LINE_BREAK);
	const headingLines = PR_PARTS.map(() => -1);
	let from = 0;
	PR_PARTS.forEach((part, i) => {
		const at = lines.findIndex((line, index) => index >= from && line.trim() === `## ${part}`);
		if (at === -1) {
			findings.push(finding('PR body', 1, `the "## ${part}" part is missing or out of order`));
		} else {
			headingLines[i] = at;
			from = at + 1;
		}
	});
	headingLines.forEach((at, i) => {
		if (at === -1) {
			return;
		}
		const next = lines.findIndex((line, index) => index > at && /^ {0,3}#{1,2}[ \t]/.test(line));
		const content = lines.slice(at + 1, next === -1 ? lines.length : next);
		if (!content.some((line) => line.trim() !== '')) {
			findings.push(finding('PR body', at + 1, `the "## ${PR_PARTS[i]}" part is empty`));
		}
	});
	// Counted like wc -w. There's no minimum, so a small change can stay short.
	const words = lines.join('\n').split(/\s+/).filter(Boolean).length;
	if (words > MAX_PR_WORDS) {
		findings.push(finding('PR body', 1, `${words} words; the limit is ${MAX_PR_WORDS}`));
	}
	return findings;
}

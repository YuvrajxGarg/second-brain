// "Using what you've saved": shared logic for the project briefing, context-aware
// resurfacing, the weekly digest and idea -> project. CommonJS so api/mcp.js,
// api/_write.js and api/edit.js can require it, and scripts/*.mjs load it with
// createRequire. The `_` prefix keeps Vercel from serving it as a function.
//
// Everything here is pure: it takes notes in the shape of site/data/brain.json
// (vault docs folded into the body as "## Vault doc: <name>" sections) and returns
// text or file contents. Nothing here talks to GitHub.
//
//   briefing(brain, {project | about})  lean markdown brief before starting work
//   activeProjects(notes, today)        projects he is working on now (by log dates)
//   focusPicks(notes, today)            unread saves ranked by fit with active projects
//   ideaToProject(idea, notes, opts)    files for a new projects/<slug>/ from an idea note
//   markIdeaStarted(text, dir, today)   the idea note's text after it became a project

const SITE = "https://brainy.pxlvzn.in";
const REFS = ["style-ref", "website-ref", "game-ref", "library", "asset-source", "tool", "technique", "advice"];
const NOT_PILE = new Set(["project", "org", "idea", "todo", "thought"]);
const CLOSED = /archiv|done|dropped|shipped|paused|abandon/i;
const GROUPS = [
  ["How-tos and lessons", ["technique", "advice"], 4],
  ["Look", ["style-ref", "website-ref", "game-ref"], 4],
  ["Build with", ["library", "asset-source", "tool"], 4],
  ["Your ideas", ["idea", "todo"], 3],
  ["Past projects", ["project", "org"], 3],
];
const STOP = new Set(
  ("the and for with that this from into your you his him are was were have has had not but all any can its it's " +
    "one two use used using make made like just more most very also than then them they their what when where which " +
    "who how out off our own over some such only each other about after before again being both could would should " +
    "does doing done get got let new old way want need saved save note notes thing things project projects work " +
    "game-ref style-ref website-ref own-project to-try inspiration reference to-read idea ideas todo status summary raw " +
    "file files link links site page http https www com").split(" ")
);

// ---------- small helpers ----------
const shortId = (n) => n.slug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
const clip = (s, max) => {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : s;
};
const words = (s) =>
  String(s || "").toLowerCase().replace(/\[\[[^\]]*\]\]|https?:\S+/g, " ")
    .split(/[^a-z0-9+#.-]+/).map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
const slugify = (s, max = 6) =>
  String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "")
    .split(/[^a-z0-9]+/).filter(Boolean).slice(0, max).join("-");
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

// Body without his raw words and vault docs (what the note itself says).
const ownText = (n) => String(n.body || "").split(/\n## (?:Raw|Vault doc: )/)[0];
// One vault doc of a project (log.md, todo.md, context.md, checks.md).
function doc(n, name) {
  const m = String(n.body || "").match(new RegExp(`## Vault doc: ${name.replace(/\./g, "\\.")}\\n\\n([\\s\\S]*?)(?=\\n\\n## Vault doc: |$)`));
  return m ? m[1] : "";
}
// log.md -> [{date, head, body}], newest first.
function logEntries(text) {
  const out = [];
  const re = /^## (\d{4}-\d{2}-\d{2})\s*[·:-]?\s*(.*)$/gm;
  const hits = [...String(text || "").matchAll(re)];
  hits.forEach((m, i) => out.push({ date: m[1], head: m[2].trim(), body: text.slice(m.index + m[0].length, i + 1 < hits.length ? hits[i + 1].index : undefined).trim() }));
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
// "**Next**" bullets (or "**Status:** line") inside one log entry.
function boldList(body, label) {
  const m = String(body || "").match(new RegExp(`\\*\\*${label}\\*\\*:?\\s*\\n((?:\\s*- .*\\n?)+)`, "i"));
  return m ? m[1].split("\n").map((l) => l.replace(/^\s*-\s*/, "").replace(/\.\s*$/, "").trim()).filter(Boolean) : [];
}
const statusLine = (body) => ((String(body || "").match(/\*\*Status:\*\*\s*(.+)/i) || [])[1] || "").trim();
const lastLog = (n) => logEntries(doc(n, "log.md"))[0] || null;
const linksIn = (s) => [...String(s || "").matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1].trim().replace(/^\d{4}-\d{2}-\d{2}-/, ""));
// Markdown table rows like "| G1 | mistake | seen | fix | enforced by |" -> short lines.
function checkRows(md, section) {
  let text = String(md || "");
  if (section) {
    const i = text.indexOf(`## ${section}`);
    if (i < 0) return [];
    text = text.slice(i + 3 + section.length).split(/\n## /)[0];
  }
  return text.split("\n").filter((l) => /^\|\s*[A-Z]+\d+\s*\|/.test(l)).map((l) => {
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    return `- ${c[0]} ${clip(c[1], 110)} -> ${c[3] || "?"}${c[4] ? `: ${clip(c[4], 90)}` : ""}`;
  });
}

// ---------- relevance ----------
// Term weights for a thing being worked on: title and stack count most.
function termsOf(parts) {
  const t = new Map();
  for (const [text, w] of parts) for (const x of new Set(words(text))) t.set(x, Math.max(t.get(x) || 0, w));
  return t;
}
function projectTerms(p) {
  return termsOf([
    [p.title, 3],
    [(p.stack || []).join(" "), 3],
    [(p.tags || []).join(" "), 2],
    [p.why, 1.5],
    [p.summary || ownText(p), 1],
    [clip(doc(p, "context.md"), 1500), 1],
    [clip(doc(p, "todo.md"), 600), 1],
  ]);
}
// Index of each note's words (meta counts more than body) plus rarity.
function indexNotes(notes) {
  const df = new Map();
  const idx = new Map();
  for (const n of notes) {
    const meta = new Set(words([n.title, (n.tags || []).join(" "), (n.style || []).join(" "), (n.stack || []).join(" "), n.why].join(" ")));
    const all = new Set([...meta, ...words(clip(n.summary || ownText(n), 900))]);
    idx.set(n.slug, { meta, all });
    for (const w of all) df.set(w, (df.get(w) || 0) + 1);
  }
  return { idx, df, N: notes.length || 1 };
}
function scoreNote(n, terms, ix) {
  const e = ix.idx.get(n.slug);
  if (!e) return 0;
  let s = 0;
  for (const [w, wt] of terms) {
    if (!e.all.has(w)) continue;
    const idf = Math.log(1 + ix.N / (ix.df.get(w) || 1));
    s += wt * idf * (e.meta.has(w) ? 1.6 : 1);
  }
  return s;
}
// Notes ranked for a set of terms; `linked` slugs (explicit [[links]]) always rank high.
function rank(notes, terms, { linked = new Set(), skip = new Set(), ix } = {}) {
  ix = ix || indexNotes(notes);
  const out = [];
  for (const n of notes) {
    if (skip.has(n.slug)) continue;
    let s = scoreNote(n, terms, ix);
    if (linked.has(shortId(n)) || linked.has(n.slug)) s += 25;
    if (s > 0) out.push({ n, s });
  }
  out.sort((a, b) => b.s - a.s || (b.n.added || "").localeCompare(a.n.added || ""));
  const top = out.length ? out[0].s : 0;
  return out.filter((x) => x.s >= Math.max(4, top * 0.22));
}
function grouped(ranked, caps = {}) {
  const lines = [];
  for (const [label, kinds, cap] of GROUPS) {
    const pick = ranked.filter(({ n }) => kinds.includes(n.kind) && (!["idea", "todo"].includes(n.kind) || !CLOSED.test(n.stage || ""))).slice(0, caps[label] ?? cap);
    if (!pick.length) continue;
    lines.push(`**${label}**`);
    for (const { n } of pick) {
      const extra = n.style?.length ? ` (${n.style.slice(0, 2).join(", ")})` : n.stage ? ` (${n.stage})` : n.state ? ` (${n.state})` : "";
      lines.push(`- ${shortId(n)}: ${n.title}${extra}. ${clip(n.why, 90)}`);
    }
  }
  return lines;
}
// Curated TASTE.md bullets that share words with the work.
function tasteLines(taste, terms, max = 4) {
  const cur = String(taste || "").split("<!-- GENERATED:START")[0];
  const bullets = cur.split(/\n(?=- )/).filter((b) => b.startsWith("- ")).map((b) => b.split(/\n+#/)[0].replace(/\s*\n\s*/g, " "));
  return bullets
    .map((b) => ({ b, s: [...terms.keys()].filter((t) => words(b).includes(t)).reduce((a, t) => a + terms.get(t), 0) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => clip(x.b, 230));
}

// ---------- projects ----------
// A project is a kind: project note, or any note a vault folder attaches to (`note:`).
const isProject = (n) => n.kind === "project" || !!n.vaultDir;
function findProject(notes, id) {
  const q = String(id || "").trim().toLowerCase();
  if (!q) return null;
  const s = slugify(q, 12);
  const ps = notes.filter(isProject);
  return (
    ps.find((n) => n.vaultDir === s || n.slug === s || shortId(n) === s || n.title.toLowerCase() === q) ||
    ps.find((n) => slugify(n.title, 12) === s) ||
    ps.find((n) => n.slug.includes(s) || n.title.toLowerCase().includes(q) || (n.vaultDir || "").includes(s)) ||
    null
  );
}
// Projects he is on now: a log entry in the last `days`, else in-progress ones added lately.
function activeProjects(notes, today = istToday(), days = 30) {
  const out = [];
  for (const n of notes.filter(isProject)) {
    if (CLOSED.test(n.state || "")) continue;
    const last = lastLog(n);
    const when = last ? last.date : n.added;
    if (!when || daysBetween(when, today) > days) continue;
    if (!last && !/progress|prototype|building|doing|wip/i.test(n.state || "")) continue;
    out.push({ n, last: when });
  }
  return out.sort((a, b) => b.last.localeCompare(a.last)).slice(0, 4);
}
// Unread saved refs (5+ days old) ranked by fit with what he is building now.
function focusPicks(notes, today = istToday(), { exclude = [], min = 6 } = {}) {
  const active = activeProjects(notes, today);
  if (!active.length) return [];
  const ex = new Set(exclude);
  const pile = notes.filter((n) => !NOT_PILE.has(n.kind) && (n.status || "unread") === "unread" && !ex.has(n.slug) && !ex.has(shortId(n)) && daysBetween(n.added || today, today) >= 5);
  const ix = indexNotes(notes);
  const best = new Map();
  for (const { n: p } of active) {
    const terms = projectTerms(p);
    const linked = new Set(linksIn(p.body));
    for (const n of pile) {
      let s = scoreNote(n, terms, ix);
      if (linked.has(shortId(n))) s += 25;
      if (s >= min && (!best.has(n.slug) || best.get(n.slug).score < s)) best.set(n.slug, { slug: n.slug, title: n.title, why: n.why, project: p.title, projectSlug: p.vaultDir || p.slug, score: Math.round(s * 10) / 10 });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 12);
}

// ---------- briefing ----------
function briefing(brain, { project, about } = {}) {
  const notes = brain.notes || [];
  const ix = indexNotes(notes);
  const out = [];
  const globalChecks = checkRows(brain.checks, "Every agent");
  if (project) {
    const p = findProject(notes, project);
    if (!p) {
      const ps = notes.filter(isProject).map((n) => n.vaultDir || shortId(n));
      return { error: `No project '${project}'. Projects: ${ps.slice(0, 40).join(", ")}. Or call with about: '<what you are starting>'.` };
    }
    const terms = projectTerms(p);
    const linked = new Set([...linksIn(p.body), ...(p.backlinks || [])]);
    const ranked = rank(notes, terms, { linked, skip: new Set([p.slug]), ix });
    const logs = logEntries(doc(p, "log.md"));
    const todos = doc(p, "todo.md").split("\n").filter((l) => /^\s*- \[ \]\s*\S/.test(l)).map((l) => l.replace(/^\s*- \[ \]\s*/, "")).slice(0, 6);
    const mistakes = logs.flatMap((e) => boldList(e.body, "Mistakes and fixes").map((m) => `${m} (${e.date})`)).slice(0, 5);
    const pChecks = checkRows(doc(p, "checks.md"));
    out.push(`# Briefing: ${p.title}`);
    out.push([p.type, p.state, p.stack?.length && `stack: ${p.stack.join(", ")}`, p.vaultDir && `vault: Documents/Vault/<${p.title}>`].filter(Boolean).join(" · "));
    if (p.why) out.push(`Made for: ${clip(p.why, 200)}`);
    out.push("", "## Where it's at");
    if (logs[0]) {
      out.push(`Last log ${logs[0].date}: ${logs[0].head}. ${clip(statusLine(logs[0].body), 260)}`);
      const next = boldList(logs[0].body, "Next").slice(0, 4);
      if (next.length) out.push("Next: " + next.map((x) => clip(x, 90)).join("; "));
    } else out.push(clip(p.summary || ownText(p), 300) || "No log yet.");
    if (todos.length) out.push("Open to-dos: " + todos.map((x) => clip(x, 70)).join("; "));
    if (mistakes.length) out.push("", "## Mistakes made here before", ...mistakes.map((m) => `- ${clip(m, 170)}`));
    out.push("", "## Checks (run every 'proved' one before saying done)", ...(pChecks.length ? pChecks : ["- (no project checks.md yet)"]), ...globalChecks);
    const taste = tasteLines(brain.taste, terms);
    if (taste.length) out.push("", "## Taste that applies", ...taste);
    const g = grouped(ranked);
    if (g.length) out.push("", "## From the brain", ...g);
  } else {
    const terms = termsOf([[about, 2]]);
    if (!terms.size) return { error: "Pass project (slug or name) or about (what you are starting, in a few words)." };
    const ranked = rank(notes, terms, { ix });
    out.push(`# Briefing: ${clip(about, 80)}`, "New work, no project folder yet. Start one with start_project (from an idea) or log_project with new_project.");
    out.push("", "## Checks", ...globalChecks);
    const taste = tasteLines(brain.taste, terms);
    if (taste.length) out.push("", "## Taste that applies", ...taste);
    const g = grouped(ranked);
    if (g.length) out.push("", "## From the brain", ...g);
    else out.push("", "Nothing saved matches yet; get_taste_profile covers his general taste.");
  }
  out.push("", "_fetch an id for the full note; get_taste_profile for the whole taste; get_checks for the full checks table._");
  return { text: out.join("\n") };
}

// ---------- idea -> project ----------
const TYPE_OF = (idea) => {
  const t = [idea.topic, ...(idea.tags || []), idea.title, idea.why].join(" ").toLowerCase();
  if (/game|gamedev/.test(t)) return "game";
  if (/website|landing|site\b|portfolio/.test(t)) return "site";
  if (/tool|plugin|cli|extension|script|mcp/.test(t)) return "tool";
  if (/app\b|saas|product/.test(t)) return "app";
  return "concept";
};
const yamlStr = (s) => {
  s = String(s || "").replace(/[\r\n]+/g, " ").trim();
  return /^[\w(][^:#]*$/.test(s) && !/^(true|false|yes|no|null)$/i.test(s) ? s : JSON.stringify(s);
};
function setField(text, k, v) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return text;
  let fm = m[1];
  const re = new RegExp(`^${k}:.*$`, "m");
  fm = re.test(fm) ? fm.replace(re, `${k}: ${v}`) : fm.replace(/^(added:.*)$/m, `${k}: ${v}\n$1`);
  return `---\n${fm}\n---` + text.slice(m[0].length);
}
function addNoteLine(text, line) {
  const m = /^## Notes[ \t]*\n/m.exec(text);
  if (!m) return text.replace(/\n*$/, "") + "\n\n## Notes\n" + line + "\n";
  const start = m.index + m[0].length;
  const nx = text.slice(start).search(/^## /m);
  const end = nx < 0 ? text.length : start + nx;
  const body = text.slice(start, end).replace(/\n+$/, "");
  const tail = text.slice(end);
  return text.slice(0, start) + (body ? body + "\n" : "") + line + "\n" + (tail ? "\n" + tail : "");
}
// The idea note after it became a project: stage doing, linked to the project.
function markIdeaStarted(text, dir, date = istToday()) {
  let t = setField(text, "stage", "doing");
  if (!t.includes(`[[${dir}]]`)) t = addNoteLine(t, `- [[${dir}]]: started as a project on ${date}`);
  return t;
}
// Files for projects/<dir>/ built from an idea note (brain.json shape). opts: title,
// type, stack, state, share, takenDirs (existing projects/ folders), today.
function ideaToProject(idea, notes, opts = {}) {
  if (!idea || !["idea", "todo"].includes(idea.kind)) return { error: "Only an idea or to-do note can become a project." };
  const today = opts.today || istToday();
  const title = String(opts.title || idea.title).replace(/[\r\n]+/g, " ").trim();
  const dir = slugify(title, 6);
  if (!dir) return { error: "Give the project a title." };
  if ((opts.takenDirs || []).includes(dir)) return { error: `projects/${dir}/ already exists. Use that project (log_project), or pick another title.` };
  const same = notes.find((n) => isProject(n) && (slugify(n.title, 6) === dir || n.vaultDir === dir));
  if (same) return { error: `There's already a project '${same.title}' (${same.vaultDir || shortId(same)}). Log to it instead of making a copy.` };
  const ideaId = shortId(idea);
  const already = notes.find((n) => isProject(n) && linksIn(n.body).includes(ideaId));
  if (already && !opts.force) return { error: `This idea already became '${already.title}' (${already.vaultDir || shortId(already)}). Log to that project, or pass force to start a separate one.` };
  const terms = termsOf([[idea.title, 3], [(idea.tags || []).join(" "), 2], [idea.why, 1.5], [idea.summary || ownText(idea), 1]]);
  const linked = new Set(linksIn(String(idea.body || "").split(/\n## Vault doc: /)[0]));
  const ranked = rank(notes, terms, { linked, skip: new Set([idea.slug]) });
  // Pre-link what the idea already links, then the strongest saved refs.
  const free = ranked.filter(({ n }) => !linked.has(shortId(n)));
  const strong = free.length ? Math.max(6, free[0].s * 0.5) : 0;
  const refs = [
    ...ranked.filter(({ n }) => linked.has(shortId(n))),
    ...ranked.filter(({ n, s }) => REFS.includes(n.kind) && !linked.has(shortId(n)) && s >= strong),
  ].slice(0, 7);
  const kindWord = { project: "related project", org: "related", idea: "related idea", todo: "related to-do", thought: "related thought", "style-ref": "the look", "website-ref": "the look", "game-ref": "a game like it", library: "build with", "asset-source": "assets", tool: "tool", technique: "how-to", advice: "advice" };
  const reason = (n) => `${kindWord[n.kind] || n.kind}: ${clip(n.why || n.title, 70).replace(/[\[\]]/g, "")}`;
  const tags = ["own-project", ...(idea.tags || []).filter((t) => !["idea", "to-try", "todo", "own-project", "inspiration"].includes(t))].slice(0, 5);
  const type = ["game", "app", "tool", "site", "concept"].includes(opts.type) ? opts.type : TYPE_OF(idea);
  const stack = (Array.isArray(opts.stack) ? opts.stack : String(opts.stack || "").split(",")).map((s) => s.trim()).filter(Boolean);
  const share = ["full", "summary", "none"].includes(opts.share) ? opts.share : "full";
  const plain = (s) => String(s || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/^#+ .*$/gm, "").trim();
  const summary = clip(plain(ownText(idea)).split(/\n\s*\n/)[0], 600) || clip(idea.why, 300);
  const projectMd = [
    "---",
    `title: ${yamlStr(title)}`,
    `type: ${type}`,
    `topic: ${idea.topic && idea.topic !== "inbox" ? idea.topic : "tech"}`,
    `tags: [${tags.join(", ")}]`,
    "kind: project",
    `why: ${yamlStr(idea.why || title)}`,
    `state: ${yamlStr(opts.state || "in progress")}`,
    `stack: [${stack.join(", ")}]`,
    "repo: private",
    `share: ${share}               # full = all docs go to the brain, summary = only this file, none = stays local`,
    "note:",
    `added: ${today}`,
    "---",
    "",
    "## Summary",
    summary,
    "",
    "## Notes",
    `- [[${ideaId}]]: the idea this started from`,
    ...refs.map(({ n }) => `- [[${shortId(n)}]]: ${reason(n)}`),
    "",
  ].join("\n");
  const g = grouped(ranked, { "Your ideas": 2, "Past projects": 3 });
  const contextMd = [
    `# ${title}: context`,
    "",
    "Context for AI tools working on this project. Keep it current; it syncs to the brain.",
    `Started ${today} from the idea [[${ideaId}]]. Before working, an agent should call get_briefing with project "${dir}".`,
    "",
    "## Start from (saved in the brain)",
    "",
    ...(g.length ? g : ["- (nothing saved matched yet)"]),
    "",
    "## Stack and setup",
    "",
    stack.length ? stack.map((s) => `- ${s}`).join("\n") : "",
    "",
    "## Conventions",
    "",
    "## Decisions",
    "",
  ].join("\n").replace(/\n{3,}/g, "\n\n");
  const body = ownText(idea);
  const steps = [...body.matchAll(/^\s*\d+[.)]\s+(.+)$/gm)].map((m) => m[1].trim()).slice(0, 8);
  const first = (body.match(/first step[^:\n]*:\**\s*(.+)/i) || [])[1];
  const todo = [...(first ? [first.trim()] : []), ...steps];
  const todoMd = `# ${title}: to-do\n\n${(todo.length ? todo : ["Decide the smallest version worth building"]).map((t) => `- [ ] ${t}`).join("\n")}\n`;
  const logMd = `# ${title}: log\n\nDated entries, newest first: status, what was learned, mistakes and fixes, taste notes.\nThe log-to-brain skill appends here.\n\n## ${today} · Started from the idea\n\n**Status:** Turned the idea "${idea.title}" into a project. ${refs.length} saved notes linked as starting points (see context.md).\n`;
  return {
    dir,
    title,
    refs: refs.map(({ n }) => shortId(n)),
    files: [
      { path: `projects/${dir}/project.md`, content: projectMd },
      { path: `projects/${dir}/context.md`, content: contextMd },
      { path: `projects/${dir}/todo.md`, content: todoMd },
      { path: `projects/${dir}/log.md`, content: logMd },
    ],
  };
}

module.exports = {
  SITE, briefing, activeProjects, isProject, focusPicks, ideaToProject, markIdeaStarted, findProject,
  logEntries, doc, shortId, clip, slugify, istToday, daysBetween, checkRows, NOT_PILE,
};

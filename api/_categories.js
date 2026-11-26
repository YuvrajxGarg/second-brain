// Busy tags grow into categories (topics). Yuvraj's ask 2026-11-26: "if there is a lot
// of things around Revolio, then Revolio doesn't stay a link or a tag, it becomes a
// category in itself." Pure functions, CommonJS, no GitHub calls, so the site
// (api/edit.js, api/sort.js), the build (scripts/build_graph.mjs) and the shell
// (scripts/categories.mjs) all give the same answer.
//
//   detect(notes, config)               proposals: busy tags that could be a category,
//                                       topics past SPLIT_AT, notes that strayed from one
//   plan(notes, name, config, opts)     the moves for promoting <name>: which notes go,
//                                       which tags they share, the colour
//   retopic(text, topic, dropTag)       a note's text with its new topic (and the tag
//                                       that became the topic dropped, keeping 3+ tags)
//   fixCanvas(json, moves)              canvases/*.canvas with moved note paths rewritten
//
// `notes` are in the brain.json / graph.json shape: { slug, path, topic, tags, title,
// kind or noteKind, type }. Only notes under topics/ ever move; projects/ and inbox/ don't.
// `config` is categories.json: { mode, colors, dismissed, created }.

const THRESHOLD = 8;        // notes on one tag (with its family) before it's proposed
const ENTITY_THRESHOLD = 6; // lower bar when the tag names one of his own orgs/projects (revolio, pxlvzn)
const MAX_SHARE = 0.7;      // a plain tag with 70%+ of its notes in one topic is a sub-theme, not a category
const SPLIT_AT = 50;        // a topic this big gets a split proposal (its busiest tag)
const MAX_NAME = 24;

// Tags that say what a note is FOR or what FORMAT it is, not what it is ABOUT. They never
// become categories, however busy. Add here when a proposal makes no sense as a folder.
const GENERIC = new Set(("to-try to-read inspiration reference own-project open-source product-idea " +
  "internal-tool game-idea game-inspiration workflow tutorial daily-challenge website web-app " +
  "desktop-app mobile-app ui visual-design plugin free concept idea tool tools resource resources " +
  "list collection guide tips advice").split(" "));

const EXTRA = ["#3dffd0", "#ffc8a0", "#ff7de0", "#5f8bff", "#b6ff8a", "#ff5f7a", "#ffd23d", "#c9a0ff",
  "#7df9ff", "#ffb03d", "#e0e0ff", "#ff3df2"]; // picked in order, skipping colours already given
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const kindOf = (n) => n.kind === "note" ? n.noteKind : (n.noteKind || n.kind);
const topicOf = (n) => (n.path || "").split("/")[0] === "topics" ? n.path.split("/")[1] : null;
const conf = (c) => ({ mode: "propose", colors: {}, dismissed: {}, created: {}, ...(c || {}) });

// A tag's family: the tag plus tags that extend it (revolio + revolio-labs, revolio-studio).
function family(tag, allTags) {
  return [tag, ...[...allTags].filter((t) => t.startsWith(tag + "-")).sort()];
}

// Does the tag name one of his own orgs or projects? Then it's an entity (a company, a
// label, a game series) and lower counts are enough.
function isEntity(tag, notes) {
  const slugRe = new RegExp(`^${tag}(-|$)`);
  return notes.some((n) => ["org", "project"].includes(kindOf(n)) && (n.tags || []).includes(tag) &&
    (slugRe.test(n.slug) || slugRe.test(String(n.title || "").toLowerCase().replace(/\s+/g, "-"))));
}

function topicsOf(notes) {
  const c = {};
  for (const n of notes) { const t = topicOf(n); if (t) c[t] = (c[t] || 0) + 1; }
  return c;
}

function detect(notes, config) {
  const cfg = conf(config);
  const filed = notes.filter((n) => topicOf(n));
  const topicCount = topicsOf(filed);
  const allTags = new Set(filed.flatMap((n) => n.tags || []));
  const tagCount = {};
  for (const n of filed) for (const t of n.tags || []) tagCount[t] = (tagCount[t] || 0) + 1;

  const proposals = [];
  const made = new Set(Object.keys(cfg.created));
  // revolio-labs is covered by revolio's family, and by revolio the category once made
  const covered = new Set(Object.entries(cfg.created).flatMap(([n, c]) => (c && c.tags) || [n]));
  const ordered = [...allTags].sort((a, b) => a.length - b.length || a.localeCompare(b));
  for (const tag of ordered) {
    if (covered.has(tag) || GENERIC.has(tag) || topicCount[tag] || cfg.dismissed[tag] || cfg.created[tag]) continue;
    if (!KEBAB.test(tag) || tag.length > MAX_NAME) continue;
    const fam = family(tag, allTags).filter((t) => !GENERIC.has(t) && !topicCount[t]);
    // notes already in a category stay there: an mcp category won't pull Revolio's app out of revolio
    const members = filed.filter((n) => !made.has(topicOf(n)) && (n.tags || []).some((t) => fam.includes(t)));
    const entity = isEntity(tag, notes);
    const need = entity ? ENTITY_THRESHOLD : THRESHOLD;
    if (members.length < need) continue;
    const from = topicsOf(members);
    const top = Object.entries(from).sort((a, b) => b[1] - a[1])[0];
    const share = top[1] / members.length;
    const split = !entity && share >= MAX_SHARE && (topicCount[top[0]] || 0) >= SPLIT_AT;
    if (!entity && share >= MAX_SHARE && !split) continue; // a sub-theme of one topic, and that topic isn't crowded
    fam.forEach((t) => covered.add(t));
    proposals.push({
      name: tag,
      tags: fam,
      count: members.length,
      entity,
      from,
      split: split ? top[0] : null,
      notes: members.map((n) => n.slug).sort(),
      reason: entity
        ? `${members.length} notes about ${tag}, one of your own orgs or projects`
        : split
          ? `${top[0]} has ${topicCount[top[0]]} notes; ${members.length} of them are ${tag}`
          : `${members.length} notes tagged ${fam.join(" / ")} across ${Object.keys(from).length} topics`,
      score: members.length * (entity ? 2 : 1) * (1.5 - share),
    });
  }
  proposals.sort((a, b) => b.score - a.score || b.count - a.count);

  // Topics past SPLIT_AT with no split proposal yet: say so, so the Sunday run can mention it.
  const crowded = Object.entries(topicCount).filter(([, c]) => c >= SPLIT_AT)
    .map(([topic, count]) => ({ topic, count, proposed: proposals.some((p) => p.split === topic) }));

  // Notes that carry a created category's tag but were filed elsewhere since (captured
  // from another chat before the category existed, or by a sort that didn't know it).
  const strays = [];
  for (const [name, info] of Object.entries(cfg.created)) {
    if (!topicCount[name]) continue;
    const tags = (info && info.tags) || [name];
    const kept = new Set((info && info.kept) || []);
    for (const n of filed) {
      if (topicOf(n) !== name && !made.has(topicOf(n)) && !kept.has(n.slug) && (n.tags || []).some((t) => tags.includes(t))) strays.push({ slug: n.slug, path: n.path, topic: topicOf(n), into: name });
    }
  }
  return { mode: cfg.mode, threshold: THRESHOLD, entityThreshold: ENTITY_THRESHOLD, splitAt: SPLIT_AT, proposals, crowded, strays };
}

function pickColor(name, cfg) {
  if (cfg.colors[name]) return cfg.colors[name];
  const used = new Set(Object.values(cfg.colors));
  const free = EXTRA.find((c) => !used.has(c));
  if (free) return free;
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const hue = (h >>> 0) % 360;
  // HSL(hue, 90%, 62%) as hex
  const f = (k) => { const a = 0.9 * Math.min(0.62, 0.38); const kk = (k + hue / 30) % 12; return Math.round(255 * (0.62 - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)))).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Everything needed to promote <name>. opts: { tags: [...] extra tags to pull in,
// keep: [slug...] notes that stay where they are (remembered, so they never count as
// strays), once: true when keep is only for this run (moving one stray), color }.
function plan(notes, name, config, opts = {}) {
  const cfg = conf(config);
  name = String(name || "").trim().toLowerCase();
  if (!KEBAB.test(name) || name.length > MAX_NAME) return { error: `"${name}" isn't a usable category name (lowercase kebab-case, ${MAX_NAME} characters max).` };
  if (name === "inbox") return { error: "inbox is not a category." };
  const filed = notes.filter((n) => topicOf(n));
  const topicCount = topicsOf(filed);
  const allTags = new Set(filed.flatMap((n) => n.tags || []));
  const created = cfg.created[name];
  if (topicCount[name] && !created) return { error: `topics/${name}/ already exists.` };
  const tags = [...new Set([...(created?.tags || family(name, allTags)), ...(opts.tags || [])])].filter(Boolean);
  const keep = new Set([...(opts.keep || []), ...(created?.kept || [])]);
  const otherCats = new Set(Object.keys(cfg.created).filter((c) => c !== name));
  const members = filed.filter((n) => topicOf(n) !== name && !otherCats.has(topicOf(n)) && (n.tags || []).some((t) => tags.includes(t)));
  const moving = members.filter((n) => !keep.has(n.slug));
  if (!moving.length) return { error: `No notes tagged ${tags.join(" / ")} to move.` };
  const moves = moving.map((n) => ({ slug: n.slug, title: n.title, from: n.path, to: `topics/${name}/${n.path.split("/").pop()}`, topic: topicOf(n) }));
  const color = /^#[0-9a-f]{6}$/i.test(opts.color || "") ? opts.color.toLowerCase() : pickColor(name, cfg);
  const kept = members.filter((n) => keep.has(n.slug)).map((n) => n.slug);
  const keptForGood = opts.once ? (created?.kept || []) : kept;
  return { name, tags, color, moves, kept, keptForGood, from: topicsOf(moving) };
}

// The note's text after the move: `topic:` set to the category, and the tag that became
// the category dropped when 3+ tags remain (the folder now says it). Sub-tags stay.
function retopic(text, topic, dropTag) {
  let out = text.replace(/^topic:[^\n]*$/m, `topic: ${topic}`);
  if (dropTag) {
    out = out.replace(/^tags:\s*\[([^\]\n]*)\]/m, (line, inner) => {
      const tags = inner.split(",").map((t) => t.trim()).filter(Boolean);
      const left = tags.filter((t) => t.replace(/^['"]|['"]$/g, "") !== dropTag);
      return left.length >= 3 && left.length < tags.length ? `tags: [${left.join(", ")}]` : line;
    });
  }
  return out;
}

// JSON Canvas boards point at notes by repo path; rewrite the ones that moved.
function fixCanvas(raw, moves) {
  const map = new Map(moves.map((m) => [m.from, m.to]));
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  let changed = false;
  for (const node of data.nodes || []) {
    if (node.type === "file" && map.has(node.file)) { node.file = map.get(node.file); changed = true; }
  }
  return changed ? JSON.stringify(data, null, 2) + "\n" : null;
}

// categories.json after a promotion or a "no".
function recordCreated(config, p, today) {
  const cfg = conf(config);
  return { ...cfg, colors: { ...cfg.colors, [p.name]: p.color }, created: { ...cfg.created, [p.name]: { date: today, tags: p.tags, notes: (cfg.created[p.name]?.notes || 0) + p.moves.length, kept: p.keptForGood || p.kept } } };
}
function recordDismissed(config, name, why, today) {
  const cfg = conf(config);
  return { ...cfg, dismissed: { ...cfg.dismissed, [name]: `${today}: ${why || "no"}` } };
}

// One line per proposal, for chat replies and the Sunday message.
function summary(d, max = 3) {
  const lines = d.proposals.slice(0, max).map((p) => `${p.name}: ${p.count} notes (${Object.entries(p.from).map(([t, c]) => `${t} ${c}`).join(", ")})`);
  if (d.strays.length) lines.push(`${d.strays.length} note${d.strays.length === 1 ? "" : "s"} tagged for an existing category filed elsewhere: ${d.strays.slice(0, 3).map((s) => `${s.slug} -> ${s.into}`).join(", ")}`);
  for (const c of d.crowded.filter((c) => !c.proposed)) lines.push(`${c.topic} has ${c.count} notes: worth splitting`);
  return lines;
}

module.exports = { THRESHOLD, ENTITY_THRESHOLD, MAX_SHARE, SPLIT_AT, GENERIC, detect, plan, retopic, fixCanvas, recordCreated, recordDismissed, summary, pickColor };

// MCP server for Yuvraj's second brain (Streamable HTTP, stateless, read-only).
// Served at https://brainy.pxlvzn.in/mcp (vercel.json rewrites /mcp here).
// No dependencies: it speaks JSON-RPC directly and reads /data/brain.json, which
// scripts/build_graph.mjs writes on every deploy.

const SITE = "https://brainy.pxlvzn.in";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const KINDS = ["style-ref", "website-ref", "game-ref", "library", "asset-source", "tool", "technique", "advice", "idea", "thought", "todo", "project", "org"];
const STAGES = ["new", "exploring", "doing", "done", "dropped"];
// catalog name -> kinds, mirrors CATALOGS in scripts/build_index.py
const CATALOG_KINDS = {
  libraries: ["library", "asset-source"],
  "style-refs": ["style-ref", "website-ref", "game-ref"],
  tools: ["tool"],
  techniques: ["technique", "advice"],
  ideas: ["idea", "thought", "todo"],
  projects: ["org", "project"],
};
const CATALOGS = Object.keys(CATALOG_KINDS);
const EVIDENCE = { kinds: "What he saves", tags: "Top tags", styles: "Style notes", references: "Every reference" };

let cache = { at: 0, brain: null };

async function loadBrain(req) {
  if (cache.brain && Date.now() - cache.at < 60_000) return cache.brain;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const urls = [host && `https://${host}/data/brain.json`, `${SITE}/data/brain.json`].filter(Boolean);
  let lastErr;
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`${u} -> ${r.status}`);
      cache = { at: Date.now(), brain: await r.json() };
      return cache.brain;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// Outputs are read by other AIs on every call, so they stay compact: short ids
// (fetch accepts the slug without its date), clipped text, no pretty-printed JSON.
const shortId = (n) => n.slug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
const clip = (s, max) => {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : s;
};

// TASTE.md = curated profile, then a generated evidence block. The curated part is
// what shapes answers; the evidence (~3/4 of the file) is only sent when asked for.
function tasteProfile(taste, evidence = "none") {
  const start = taste.indexOf("<!-- GENERATED:START");
  if (start < 0) return taste;
  const curated = taste.slice(0, start).trim();
  const gen = taste.slice(start).replace(/<!--[^>]*-->/g, "").trim();
  if (evidence === "all") return curated + "\n\n" + gen;
  if (EVIDENCE[evidence]) {
    const sec = gen.split(/\n(?=### )/).find((x) => x.startsWith("### " + EVIDENCE[evidence]));
    return curated + "\n\n## Evidence (generated)\n\n" + (sec || "(section not found)").trim();
  }
  return (
    curated +
    `\n\n_Evidence block left out (~${Math.round(gen.length / 4 / 100) * 100} tokens). Only if you need sources: get_taste_profile with evidence = styles (each style note and its notes), references (every reference with his reason), kinds, tags or all._`
  );
}

// One line per note: id | title | status | what it is | stack or style.
function catalogLines(list) {
  return list.map((n) => {
    const status = n.state || n.stage || "";
    const extra = n.stack?.length ? `stack: ${n.stack.join(", ")}` : n.style?.length ? `style: ${n.style.slice(0, 3).join(", ")}` : "";
    return [shortId(n), n.title, n.kind, status, clip(n.why, 110), extra].filter(Boolean).join(" | ");
  });
}

const noteUrl = (n) => `${SITE}/#/n/${encodeURIComponent(n.slug)}`;
const words = (s) => String(s || "").toLowerCase().split(/[^a-z0-9+#.-]+/).filter((w) => w.length > 1);

function score(n, terms) {
  const title = n.title.toLowerCase();
  const meta = [n.kind, n.topic, n.type, ...(n.tags || []), ...(n.style || []), n.why].join(" ").toLowerCase();
  const body = n.body.toLowerCase();
  let s = 0;
  for (const t of terms) {
    if (title.includes(t)) s += 6;
    if (meta.includes(t)) s += 3;
    if (body.includes(t)) s += 1;
  }
  return s;
}

function filterNotes(notes, a = {}) {
  return notes.filter(
    (n) =>
      (!a.kind || n.kind === a.kind) &&
      (!a.topic || n.topic === a.topic) &&
      (!a.tag || (n.tags || []).includes(String(a.tag).toLowerCase()))
  );
}

function noteText(n) {
  const head = [
    `# ${n.title}`,
    "",
    `kind: ${n.kind || "?"}${n.stage ? ` · stage: ${n.stage}` : ""}${n.state ? ` · state: ${n.state}` : ""} · type: ${n.type} · topic: ${n.topic} · added: ${n.added}`,
    n.why && `why saved: ${n.why}`,
    n.style?.length && `style: ${n.style.join(", ")}`,
    n.stack?.length && `stack: ${n.stack.join(", ")}`,
    n.tags?.length && `tags: ${n.tags.join(", ")}`,
    n.source && `source: ${n.source}`,
    `file: ${n.path}`,
  ].filter(Boolean);
  // Image embeds point at files next to the note; make them absolute.
  const dir = n.path.split("/").slice(0, -1).join("/");
  const body = n.body.replace(/\]\(\.\/([^)\s]+)\)/g, (_, f) => `](${SITE}/data/media/${dir}/${f})`);
  return head.join("\n") + "\n\n" + body;
}

const TOOLS = [
  {
    name: "get_taste_profile",
    title: "Get Yuvraj's taste profile",
    description:
      "Read this first. Returns the curated taste profile (~1.7k tokens): who Yuvraj is, his visual taste, the games he likes, the libraries, tools and stack he prefers, and how to use that when helping him. Enough for most answers. The generated evidence block is left out unless you pass `evidence`; ask for it only when you need to cite which notes back a taste.",
    inputSchema: {
      type: "object",
      properties: {
        evidence: {
          type: "string",
          enum: ["none", ...Object.keys(EVIDENCE), "all"],
          default: "none",
          description: "Extra generated evidence to append: styles (style notes and the notes behind each), references (every reference with his reason), kinds, tags, or all (~6k tokens).",
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "search",
    title: "Search the second brain",
    description:
      "Full-text search over every saved note (links, style references, libraries, tools, techniques, ideas). Matches title, tags, style notes, his reason for saving, and the body. Returns ids with a short snippet; `fetch` an id only when you need the full note. Optional filters: kind, topic.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for, e.g. 'pixel art', 'three.js assets', 'launch film'." },
        kind: { type: "string", enum: KINDS, description: "Only this kind of note." },
        topic: { type: "string", description: "Only this topic folder, e.g. design, gamedev, ai." },
        limit: { type: "integer", minimum: 1, maximum: 30, default: 6 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "fetch",
    title: "Fetch a note",
    description:
      "Return the full markdown of one note by id (from `search`, `list_notes`, `get_catalog` or `recall_ideas`), including his own words under ## Raw. Use it for the few notes you actually need. Special ids: 'taste' (all of TASTE.md with evidence), 'ideas' (IDEAS.md), 'agents' (AGENTS.md), 'catalog:<name>' (the long markdown catalog with every summary).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_notes",
    title: "List notes",
    description:
      "List notes newest first as one short line each (id, title, kind, topic, why saved). Filter by kind (e.g. library for UI and code libraries, style-ref for visual references, game-ref for games he likes), topic or tag. Prefer `search` when you know what you are looking for.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: KINDS },
        topic: { type: "string" },
        tag: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 30 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "recall_ideas",
    title: "Recall his ideas and to-dos",
    description:
      "Call back Yuvraj's own ideas and to-dos (product ideas, game ideas, captions, tasks). By default returns open ones (new, exploring, doing), newest first, with his reason and a short summary (fetch an id for the full note). Filter by stage, topic or a query. Use it when he asks 'what ideas did I have about X', or to suggest picking an old idea back up.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional words to match, e.g. 'revolio', 'game', 'caption'." },
        stage: { type: "string", enum: [...STAGES, "open", "all"], default: "open" },
        topic: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_catalog",
    title: "Get a catalog",
    description:
      "Return one catalog as one line per note (id | title | kind | state | what it is | stack or style): libraries (UI libraries, design systems, asset sources), style-refs (visual, website and game references), tools, techniques, ideas, projects (games, apps and tools he has built himself, plus Revolio and Revolio Labs, the companies he works in). `fetch` the ids you need for details; detail 'full' returns every summary and costs about 4x more.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", enum: CATALOGS },
        detail: { type: "string", enum: ["compact", "full"], default: "compact" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

const text = (t) => ({ content: [{ type: "text", text: t }] });
const fail = (t) => ({ content: [{ type: "text", text: t }], isError: true });

async function callTool(name, a = {}, req) {
  const brain = await loadBrain(req);
  const notes = brain.notes;
  switch (name) {
    case "get_taste_profile":
      return text(tasteProfile(brain.taste, a.evidence));
    case "search": {
      const terms = words(a.query);
      if (!terms.length) return fail("Give a query with at least one word.");
      const hits = filterNotes(notes, a)
        .map((n) => ({ n, s: score(n, terms) }))
        .filter((h) => h.s > 0)
        .sort((x, y) => y.s - x.s || (y.n.added || "").localeCompare(x.n.added || ""))
        .slice(0, a.limit || 6)
        .map(({ n }) => ({
          id: n.slug,
          title: n.title,
          url: noteUrl(n),
          kind: n.kind,
          topic: n.topic,
          why: clip(n.why, 120),
          ...(n.style?.length ? { style: n.style.join(", ") } : {}),
          snippet: clip(n.summary, 180),
        }));
      return text(JSON.stringify({ results: hits }));
    }
    case "fetch": {
      const id = String(a.id || "").trim();
      if (id === "taste") return text(JSON.stringify({ id, title: "Taste profile", url: `${SITE}/TASTE.md`, text: brain.taste }));
      if (id === "ideas") return text(JSON.stringify({ id, title: "Ideas and to-dos", url: `${SITE}/IDEAS.md`, text: brain.ideas }));
      if (id === "agents") return text(JSON.stringify({ id, title: "AGENTS.md", url: `${SITE}/AGENTS.md`, text: brain.agents }));
      if (id.startsWith("catalog:")) {
        const c = brain.catalogs[id.slice(8)];
        return c ? text(JSON.stringify({ id, title: id, url: `${brain.repo}/blob/main/catalog/${id.slice(8)}.md`, text: c })) : fail(`No catalog ${id}. Use one of: ${CATALOGS.join(", ")}.`);
      }
      const n = notes.find((x) => x.slug === id || x.slug.endsWith(id) || x.title.toLowerCase() === id.toLowerCase());
      if (!n) return fail(`No note with id '${id}'. Use search or list_notes to find ids.`);
      return text(
        // kind, tags, why, style and source are already in the text header
        JSON.stringify({ id: n.slug, title: n.title, url: noteUrl(n), text: noteText(n) })
      );
    }
    case "list_notes": {
      const all = filterNotes(notes, a);
      const off = a.offset || 0;
      const list = all.slice(off, off + (a.limit || 30));
      if (!list.length) return text("No notes match.");
      const more = all.length > off + list.length ? `\n(${off + 1}-${off + list.length} of ${all.length}; pass offset ${off + list.length} for more)` : "";
      return text(list.map((n) => `${shortId(n)} | ${n.title} | ${n.kind || "?"} | ${n.topic} | ${clip(n.why, 90)}`).join("\n") + more);
    }
    case "recall_ideas": {
      const want = a.stage || "open";
      const terms = words(a.query);
      const list = notes
        .filter((n) => n.kind === "idea" || n.kind === "todo")
        .filter((n) => !a.topic || n.topic === a.topic)
        .filter((n) => {
          const st = n.stage || "new";
          return want === "all" || (want === "open" ? ["new", "exploring", "doing"].includes(st) : st === want);
        })
        .filter((n) => !terms.length || score(n, terms) > 0);
      if (!list.length) return text(`No ${want} ideas${a.query ? ` matching '${a.query}'` : ""}.`);
      const shown = list.slice(0, a.limit || 20);
      return text(
        shown
          .map((n) => `## ${n.title} (${n.kind}, ${n.stage || "new"}, ${n.topic}, ${n.added})\nid: ${shortId(n)}\nwhy: ${clip(n.why, 140)}\n${clip(n.summary, 220)}`)
          .join("\n\n") + (list.length > shown.length ? `\n\n(${shown.length} of ${list.length}; raise limit for more)` : "")
      );
    }
    case "get_catalog": {
      const kinds = CATALOG_KINDS[a.name];
      if (!kinds) return fail(`No catalog '${a.name}'. Use one of: ${CATALOGS.join(", ")}.`);
      if (a.detail === "full") return text(brain.catalogs[a.name] || "Empty catalog.");
      const list = notes.filter((n) => kinds.includes(n.kind));
      return text(`# ${a.name} (${list.length})\nid | title | kind | state | what it is | stack or style\n` + catalogLines(list).join("\n"));
    }
    default:
      return null;
  }
}

async function handle(msg, req) {
  const { id, method, params = {} } = msg || {};
  const isNote = id === undefined || id === null;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return err(-32600, "Invalid request");
  if (isNote) return null; // notifications/initialized etc.
  try {
    switch (method) {
      case "initialize":
        return ok({
          protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "yuvraj-second-brain", title: "Yuvraj's second brain", version: "1.1.0" },
          instructions:
            "Yuvraj's personal knowledge base and taste profile. Call get_taste_profile first (curated summary, no evidence needed) to learn his visual taste, the games he likes and his preferred stack. Then pull only what the question needs: search for specific references and libraries, recall_ideas for his own ideas and to-dos, get_catalog('projects') for what he has already built. Every list is compact (id + one line); fetch an id only for notes you will actually use. Prefer what he has saved when suggesting designs, UI libraries, assets or tools.",
        });
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: TOOLS });
      case "tools/call": {
        const r = await callTool(params.name, params.arguments || {}, req);
        return r ? ok(r) : err(-32602, `Unknown tool: ${params.name}`);
      }
      case "resources/list":
        return ok({ resources: [] });
      case "prompts/list":
        return ok({ prompts: [] });
      default:
        return err(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return err(-32603, `Internal error: ${e.message}`);
  }
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    return typeof req.body === "string" ? JSON.parse(req.body) : Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "DELETE") return res.status(405).end();
  if (req.method === "GET") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({
      name: "Yuvraj's second brain MCP server",
      usage: `Add ${SITE}/mcp as a remote MCP server (Streamable HTTP, no auth). Tools: ${TOOLS.map((t) => t.name).join(", ")}.`,
    });
  }
  if (req.method !== "POST") return res.status(405).end();

  let body;
  try {
    body = await readBody(req);
  } catch {
    return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  const batch = Array.isArray(body);
  const replies = (await Promise.all((batch ? body : [body]).map((m) => handle(m, req)))).filter(Boolean);
  if (!replies.length) return res.status(202).end();
  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(JSON.stringify(batch ? replies : replies[0]));
};

// MCP server for Yuvraj's second brain (Streamable HTTP, stateless, read-only).
// Served at https://brainy.pxlvzn.in/mcp (vercel.json rewrites /mcp here).
// No dependencies: it speaks JSON-RPC directly and reads /data/brain.json, which
// scripts/build_graph.mjs writes on every deploy.

const SITE = "https://brainy.pxlvzn.in";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const KINDS = ["style-ref", "website-ref", "game-ref", "library", "asset-source", "tool", "technique", "advice", "idea", "thought", "todo"];
const STAGES = ["new", "exploring", "doing", "done", "dropped"];
const CATALOGS = ["libraries", "style-refs", "tools", "techniques", "ideas"];

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
    `kind: ${n.kind || "?"}${n.stage ? ` · stage: ${n.stage}` : ""} · type: ${n.type} · topic: ${n.topic} · added: ${n.added}`,
    n.why && `why saved: ${n.why}`,
    n.style?.length && `style: ${n.style.join(", ")}`,
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
      "Read this first. Returns TASTE.md: Yuvraj's visual taste (art and design styles he likes), the games he likes, the libraries, tools and stack he prefers, and how to use that when helping him, with evidence links. Use it to personalise any design, UI, game or content suggestion.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "search",
    title: "Search the second brain",
    description:
      "Full-text search over every saved note (links, style references, libraries, tools, techniques, ideas). Matches title, tags, style notes, his reason for saving, and the body. Returns ids to pass to `fetch`. Optional filters: kind, topic.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for, e.g. 'pixel art', 'three.js assets', 'launch film'." },
        kind: { type: "string", enum: KINDS, description: "Only this kind of note." },
        topic: { type: "string", description: "Only this topic folder, e.g. design, gamedev, ai." },
        limit: { type: "integer", minimum: 1, maximum: 30, default: 8 },
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
      "Return the full markdown of one note by id (its slug, from `search` or `list_notes`), including his own words under ## Raw. Special ids: 'taste' (TASTE.md), 'ideas' (IDEAS.md), 'agents' (AGENTS.md), 'catalog:<name>' where name is one of libraries, style-refs, tools, techniques, ideas.",
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
      "List notes newest first as one line each (id, title, kind, topic, why saved). Filter by kind (e.g. library for UI and code libraries, style-ref for visual references, game-ref for games he likes), topic or tag.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: KINDS },
        topic: { type: "string" },
        tag: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "recall_ideas",
    title: "Recall his ideas and to-dos",
    description:
      "Call back Yuvraj's own ideas and to-dos (product ideas, game ideas, captions, tasks). By default returns open ones (new, exploring, doing), newest first, with his reason and summary. Filter by stage, topic or a query. Use it when he asks 'what ideas did I have about X', or to suggest picking an old idea back up.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional words to match, e.g. 'revolio', 'game', 'caption'." },
        stage: { type: "string", enum: [...STAGES, "open", "all"], default: "open" },
        topic: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_catalog",
    title: "Get a catalog",
    description:
      "Return one generated catalog with a short entry per note: libraries (UI libraries, design systems, asset sources), style-refs (visual, website and game references), tools, techniques, ideas.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", enum: CATALOGS } },
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
      return text(brain.taste);
    case "search": {
      const terms = words(a.query);
      if (!terms.length) return fail("Give a query with at least one word.");
      const hits = filterNotes(notes, a)
        .map((n) => ({ n, s: score(n, terms) }))
        .filter((h) => h.s > 0)
        .sort((x, y) => y.s - x.s || (y.n.added || "").localeCompare(x.n.added || ""))
        .slice(0, a.limit || 8)
        .map(({ n }) => ({
          id: n.slug,
          title: n.title,
          url: noteUrl(n),
          kind: n.kind,
          topic: n.topic,
          why: n.why,
          style: n.style,
          snippet: (n.summary || "").slice(0, 280),
        }));
      return text(JSON.stringify({ results: hits }, null, 2));
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
        JSON.stringify({
          id: n.slug,
          title: n.title,
          url: noteUrl(n),
          text: noteText(n),
          metadata: { kind: n.kind, topic: n.topic, tags: n.tags, style: n.style, why: n.why, source: n.source, added: n.added },
        })
      );
    }
    case "list_notes": {
      const list = filterNotes(notes, a).slice(0, a.limit || 50);
      if (!list.length) return text("No notes match.");
      return text(list.map((n) => `${n.slug} | ${n.title} | ${n.kind || "?"} | ${n.topic} | ${n.why || ""}`).join("\n"));
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
      return text(
        list
          .map((n) => `## ${n.title} (${n.kind}, ${n.stage || "new"}, ${n.topic}, ${n.added})\nid: ${n.slug}\nwhy: ${n.why || ""}\n${n.summary}`)
          .join("\n\n")
      );
    }
    case "get_catalog": {
      const c = brain.catalogs[a.name];
      return c ? text(c) : fail(`No catalog '${a.name}'. Use one of: ${CATALOGS.join(", ")}.`);
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
          serverInfo: { name: "yuvraj-second-brain", title: "Yuvraj's second brain", version: "1.0.0" },
          instructions:
            "Yuvraj's personal knowledge base and taste profile. Call get_taste_profile first to learn his visual taste, the games he likes and his preferred stack, then use search / list_notes / fetch to pull specific references and libraries, and recall_ideas to call back his own ideas and to-dos. Prefer what he has saved when suggesting designs, UI libraries, assets or tools.",
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

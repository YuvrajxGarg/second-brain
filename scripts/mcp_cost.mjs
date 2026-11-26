// Measures what the MCP server (api/mcp.js) costs an agent in tokens, offline.
// Runs the real handler against the local site/data/brain.json (run build_graph.mjs
// first) and prints JSON: {tool: {chars, tokens}} plus a "typical session" total.
// Tokens are estimated as chars / 4 (close enough to spot a regression).
//
//   node scripts/build_graph.mjs && node scripts/mcp_cost.mjs
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRAIN = path.join(ROOT, "site", "data", "brain.json");
if (!existsSync(BRAIN)) {
  console.error("site/data/brain.json missing: run node scripts/build_graph.mjs first");
  process.exit(1);
}
const brain = JSON.parse(readFileSync(BRAIN, "utf8"));
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => brain });
delete process.env.CAPTURE_KEY; // measure the read-only server every agent sees
const handler = createRequire(import.meta.url)(path.join(ROOT, "api", "mcp.js"));

async function rpc(method, params = {}) {
  let out = "";
  const req = { method: "POST", headers: { host: "localhost" }, url: "/mcp", query: {}, body: { jsonrpc: "2.0", id: 1, method, params } };
  const res = {
    setHeader() {}, status() { return this; }, end() { return this; },
    json(o) { out = JSON.stringify(o); return this; }, send(s) { out = String(s); return this; },
  };
  await handler(req, res);
  return out;
}
const call = (name, args = {}) => rpc("tools/call", { name, arguments: args });

const sample = brain.notes.find((n) => n.kind === "technique") || brain.notes[0];
const probes = {
  "setup (initialize + tools/list)": async () => (await rpc("initialize", { protocolVersion: "2025-06-18" })) + (await rpc("tools/list")),
  get_taste_profile: () => call("get_taste_profile"),
  "get_taste_profile evidence=all": () => call("get_taste_profile", { evidence: "all" }),
  "search 'pixel art'": () => call("search", { query: "pixel art" }),
  [`fetch ${sample.slug}`]: () => call("fetch", { id: sample.slug }),
  list_notes: () => call("list_notes", {}),
  recall_ideas: () => call("recall_ideas", {}),
  get_checks: () => call("get_checks", {}),
};
for (const c of Object.keys(brain.catalogs || {})) probes[`get_catalog ${c}`] = () => call("get_catalog", { name: c });

const out = {};
for (const [k, fn] of Object.entries(probes)) {
  const s = await fn();
  out[k] = { chars: s.length, tokens: Math.round(s.length / 4) };
}
// What a normal "use my taste" chat spends: setup, taste, one search, one fetch.
const typical = ["setup (initialize + tools/list)", "get_taste_profile", "search 'pixel art'", `fetch ${sample.slug}`];
out["typical session"] = { tokens: typical.reduce((a, k) => a + out[k].tokens, 0), of: typical };
console.log(JSON.stringify(out, null, 1));

import { capture, getSettings, saveSettings, testConnection, MAX_FILE_MB } from "./lib.js";

const $ = (id) => document.getElementById(id);
const files = [];
let pageTitle = "";
let pageUrl = "";

// ---------- init ----------

(async function init() {
  const cfg = await getSettings();
  for (const k of ["owner", "repo", "branch", "token"]) $(k).value = cfg[k];
  if (!cfg.token) showSettings(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && /^https?:/.test(tab.url || "")) {
      pageUrl = tab.url;
      pageTitle = tab.title || "";
      $("url").value = pageUrl;
      $("pageTitle").textContent = pageTitle;
    }
  } catch {}

  // Restore an unsent draft (popup closes when you click away).
  const { draft } = await chrome.storage.session.get("draft").catch(() => ({}));
  if (draft?.text) $("text").value = draft.text;
  $("text").focus();
})();

$("text").addEventListener("input", () => chrome.storage.session.set({ draft: { text: $("text").value } }).catch(() => {}));

// ---------- link ----------

$("clearUrl").addEventListener("click", (e) => {
  e.preventDefault();
  $("url").value = "";
  $("pageTitle").textContent = "";
  $("url").focus();
});
$("url").addEventListener("input", () => {
  if ($("url").value.trim() !== pageUrl) $("pageTitle").textContent = "";
  else $("pageTitle").textContent = pageTitle;
});

// ---------- files ----------

function addFiles(list) {
  for (const f of list) {
    if (!/^(image|video)\//.test(f.type)) { setStatus(`Skipped "${f.name}": only images and videos.`, "err"); continue; }
    if (f.size > MAX_FILE_MB * 1048576) {
      setStatus(`"${f.name || "file"}" is ${(f.size / 1048576).toFixed(1)} MB (limit ${MAX_FILE_MB} MB). Save a link to it instead.`, "err");
      continue;
    }
    if (!f.name || f.name === "image.png") {
      // Pasted screenshots have no useful name.
      const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
      f = new File([f], `pasted-${files.length + 1}.${ext}`, { type: f.type });
    }
    files.push(f);
  }
  renderPreviews();
}

function renderPreviews() {
  const ul = $("previews");
  ul.innerHTML = "";
  files.forEach((f, i) => {
    const li = document.createElement("li");
    if (f.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      li.append(img);
    } else if (f.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.src = URL.createObjectURL(f);
      v.muted = true;
      li.append(v);
    } else {
      li.textContent = f.name;
    }
    li.title = `${f.name} (${(f.size / 1048576).toFixed(1)} MB)`;
    const x = document.createElement("button");
    x.textContent = "✕";
    x.title = "Remove";
    x.onclick = () => { files.splice(i, 1); renderPreviews(); };
    li.append(x);
    ul.append(li);
  });
}

$("pick").addEventListener("click", (e) => { e.preventDefault(); $("files").click(); });
$("files").addEventListener("change", (e) => { addFiles([...e.target.files]); e.target.value = ""; });
const drop = $("drop");
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("files").click(); } });
for (const ev of ["dragenter", "dragover"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); });
for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]);
  else {
    const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (uri) $("text").value += ($("text").value ? "\n" : "") + uri;
  }
});
document.addEventListener("paste", (e) => {
  const pasted = [...(e.clipboardData?.files || [])];
  if (pasted.length) { e.preventDefault(); addFiles(pasted); }
});

// ---------- save ----------

function setStatus(html, cls = "", el = $("status")) {
  el.className = cls;
  el.innerHTML = html;
}

async function doSave() {
  const btn = $("save");
  btn.disabled = true;
  try {
    const url = $("url").value.trim();
    const res = await capture(
      { text: $("text").value, url, pageTitle: url && url === pageUrl ? pageTitle : "", files: [...files] },
      (msg) => setStatus(msg)
    );
    setStatus(`Saved to inbox ✓ <a href="${res.fileUrl}" target="_blank">view</a>`, "ok");
    $("text").value = "";
    files.length = 0;
    renderPreviews();
    chrome.storage.session.remove("draft").catch(() => {});
    setTimeout(() => window.close(), 1400);
  } catch (e) {
    setStatus(escapeHtml(e.message || String(e)), "err");
  } finally {
    btn.disabled = false;
  }
}

$("save").addEventListener("click", doSave);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !$("capture").hidden) { e.preventDefault(); doSave(); }
});

// ---------- settings ----------

function showSettings(on) {
  $("settings").hidden = !on;
  $("capture").hidden = on;
}
$("gear").addEventListener("click", () => showSettings($("settings").hidden));

const readForm = () => ({
  owner: $("owner").value.trim(),
  repo: $("repo").value.trim(),
  branch: $("branch").value.trim() || "main",
  token: $("token").value.trim(),
});

$("test").addEventListener("click", async () => {
  setStatus("Checking…", "", $("settingsStatus"));
  try {
    const name = await testConnection(readForm());
    setStatus(`Connected to ${escapeHtml(name)} ✓`, "ok", $("settingsStatus"));
  } catch (e) {
    setStatus(escapeHtml(e.message), "err", $("settingsStatus"));
  }
});
$("saveSettings").addEventListener("click", async () => {
  await saveSettings(readForm());
  setStatus("Saved ✓", "ok", $("settingsStatus"));
  setTimeout(() => showSettings(false), 600);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

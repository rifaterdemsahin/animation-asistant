// Prompt Editor: list / view / edit / reset / preview generation prompts.
const api = "/api/prompts";

let prompts = [];
let current = null;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function json(url, opts) {
  const r = await fetch(url, { credentials: "same-origin", ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

function setStatus(msg, isErr) {
  const el = document.getElementById("pm-status");
  el.textContent = msg || "";
  el.className = "pm-status " + (isErr ? "error" : "muted");
}

function renderList() {
  const ul = document.getElementById("pm-list");
  ul.innerHTML = "";
  for (const p of prompts) {
    const li = document.createElement("li");
    if (current && current.id === p.id) li.className = "active";
    li.innerHTML = `<div>${escapeHtml(p.title)}</div>` +
      (p.dirty ? `<div class="pm-dirty">● edited</div>` : "");
    li.addEventListener("click", () => select(p.id));
    ul.append(li);
  }
}

function select(id) {
  const p = prompts.find(x => x.id === id);
  if (!p) return;
  current = p;
  renderList();
  const editor = document.getElementById("pm-editor");
  editor.classList.remove("hidden");
  document.getElementById("pm-title").textContent = p.title;
  document.getElementById("pm-desc").textContent = p.description;
  document.getElementById("pm-textarea").value = p.raw;
  const vars = document.getElementById("pm-vars");
  vars.innerHTML = (p.variables || [])
    .map(v => `<code>{{${escapeHtml(v)}}}</code>`).join("");
  document.getElementById("pm-preview-wrap").classList.add("hidden");
  setStatus("");
}

// Try to pretty-print the textarea JSON for nicer editing.
function formatJson() {
  const ta = document.getElementById("pm-textarea");
  try {
    const obj = JSON.parse(ta.value);
    ta.value = JSON.stringify(obj, null, 2);
    setStatus("formatted");
  } catch (e) {
    setStatus("not valid JSON yet — " + e.message, true);
  }
}

async function save() {
  if (!current) return;
  const ta = document.getElementById("pm-textarea");
  const raw = ta.value;
  try { JSON.parse(raw); }
  catch (e) { setStatus("invalid JSON: " + e.message, true); return; }
  const btn = document.getElementById("pm-save-btn");
  btn.disabled = true; const label = btn.textContent; btn.textContent = "Saving…";
  try {
    const res = await json(`${api}/${current.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    current.raw = raw;
    current.dirty = !!res.dirty;
    document.getElementById("pm-textarea").value = raw;
    renderList();
    setStatus(res.dirty ? "saved (edited from default)" : "saved (matches default)");
  } catch (err) {
    setStatus("save failed: " + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}

async function reset() {
  if (!current) return;
  if (!confirm(`Reset "${current.title}" to the compiled default? This discards your edits.`)) return;
  try {
    const res = await json(`${api}/${current.id}/reset`, { method: "POST" });
    current.raw = res.raw;
    current.dirty = false;
    document.getElementById("pm-textarea").value = res.raw;
    renderList();
    setStatus("reset to default");
  } catch (err) {
    setStatus("reset failed: " + err.message, true);
  }
}

// Client-side preview: render the string fields with sample variable values.
function preview() {
  if (!current) return;
  const ta = document.getElementById("pm-textarea");
  let obj;
  try { obj = JSON.parse(ta.value); }
  catch (e) { setStatus("invalid JSON: " + e.message, true); return; }

  const samples = {
    topic: "photosynthesis",
    component_type: "explainer",
    act_key: "act-2",
    act_role: "solution",
    summary: "the solution is introduced and shown resolving the problem",
    purpose: "Introduce the solution; show how the problem is resolved.",
    style: "clean infographic with simple data visualization using icons and numbers, flat vector",
    beat: "the key idea clicks into place",
    genre: "cinematic",
    mood: "inspiring and uplifting",
    desc: "a quick whoosh transition sound effect",
    context: "Title: Photosynthesis\nTopic: photosynthesis\n\n== Act 2 — Solution (solution) ==\nSCRIPT: {…}\nCOMPONENTS: q1-…-infographic-01",
  };
  const render = (s) => (s || "").replace(/\{\{(\w+)\}\}/g, (_, k) => samples[k] || `{{${k}}}`);

  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") parts.push(`— ${k} —\n${render(v)}`);
    else parts.push(`— ${k} —\n${JSON.stringify(v, null, 2)}`);
  }
  document.getElementById("pm-preview").textContent = parts.join("\n\n");
  document.getElementById("pm-preview-wrap").classList.remove("hidden");
}

async function load() {
  try {
    const data = await json(api);
    document.getElementById("pm-store").textContent = "store: " + data.store;
    prompts = data.prompts || [];
    renderList();
    if (prompts.length) select(prompts[0].id);
  } catch (err) {
    setStatus("load failed: " + err.message, true);
  }
}

document.addEventListener("layout:ready", () => {
  document.getElementById("pm-save-btn").addEventListener("click", save);
  document.getElementById("pm-reset-btn").addEventListener("click", reset);
  document.getElementById("pm-preview-btn").addEventListener("click", preview);
  document.getElementById("pm-textarea").addEventListener("dblclick", formatJson);
  // Ctrl/Cmd+S to save.
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault(); save();
    }
  });
  load();
});

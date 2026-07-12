// Storyboard Creator: turn the project's Question/Answer/Why into per-act
// storyboard images via the Gemini nanobanana image model. Each Execute
// generates 3 images — one per act (act-1/act-2/act-3). Each generation is
// saved as a new version (never overwritten); all are shown grouped by act.
const api = "/api";
const pid = () => (window.currentProject && window.currentProject() || {}).project_id;

// Fixed 3-act structure (mirrors server/acts.go).
const ACTS = [
  {key: "act-1", title: "Act 1 — Problem",  role: "problem"},
  {key: "act-2", title: "Act 2 — Solution", role: "solution"},
  {key: "act-3", title: "Act 3 — Lesson",   role: "lesson"},
];

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
async function json(url, opts) {
  const r = await fetch(url, { credentials: "same-origin", ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}
function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = "Working…"; }
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
}

let promptTemplate = null;
let modelName = "";

// One version card (image + prompt details). Used for every act's gallery.
function versionCard(v, actTitle) {
  const rawUrl = `${api}/projects/${pid()}/raw/${v.file}`;
  const bust = rawUrl + (rawUrl.includes("?") ? "&" : "?") + "_t=" + encodeURIComponent(v.created_at || ("v" + v.id));
  const actKey = v.act || "storyboard";
  const downloadName = `${actKey}-v${v.id}.png`;

  const card = document.createElement("div");
  card.className = "panel";
  card.style.marginTop = "12px";
  card.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center">
      <strong>${escapeHtml(actTitle || "")} · v${v.id}</strong>
      <span class="muted" style="font-size:12px">${escapeHtml(v.created_at || "")}${v.image_model ? " · " + escapeHtml(v.image_model) : ""}</span>
    </div>
    <img alt="storyboard ${escapeHtml(v.act || "")} v${v.id}" style="max-width:100%;border-radius:8px;border:1px solid var(--border);margin-top:8px;display:block">
    <div class="row" style="margin-top:8px;gap:8px;align-items:center">
      <button class="btn sb-download-btn">⬇ Download</button>
      <button class="btn sb-copy-btn">📋 Copy</button>
      <span class="muted sb-status" style="font-size:12px;display:none"></span>
    </div>
    <details style="margin-top:6px"><summary class="muted" style="cursor:pointer;font-size:12px">Image prompt</summary>
      <pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;margin-top:6px;background:var(--panel-2);padding:8px;border-radius:6px;overflow:auto;max-height:240px">${escapeHtml(v.image_prompt || "")}</pre>
    </details>`;

  const img = card.querySelector("img");
  img.src = bust;
  img.onerror = () => { img.alt = "image not found"; img.removeAttribute("src"); img.style.border = "1px dashed var(--border)"; };

  const statusEl = card.querySelector(".sb-status");
  card.querySelector(".sb-download-btn").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = bust;
    a.download = downloadName;
    a.click();
  });
  card.querySelector(".sb-copy-btn").addEventListener("click", async () => {
    try {
      const resp = await fetch(bust);
      if (!resp.ok) throw new Error("fetch failed");
      const blob = await resp.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      statusEl.textContent = "Copied!";
      statusEl.style.display = "";
      setTimeout(() => { statusEl.style.display = "none"; }, 2000);
    } catch (err) {
      statusEl.textContent = "Copy failed: " + err.message;
      statusEl.style.display = "";
      setTimeout(() => { statusEl.style.display = "none"; }, 3000);
    }
  });

  return card;
}

// Render every generated version grouped by act (newest first within each act).
function renderVersions(versions) {
  const wrap = document.getElementById("sb-image-wrap");
  const count = document.getElementById("sb-count");
  if (count) count.textContent = versions && versions.length ? `(${versions.length})` : "";

  const byAct = {"act-1": [], "act-2": [], "act-3": [], legacy: []};
  for (const v of (versions || [])) {
    const k = v.act && byAct[v.act] ? v.act : "legacy";
    byAct[k].push(v);
  }

  wrap.innerHTML = "";
  const sections = [
    {key: "act-1", title: "Act 1 — Problem"},
    {key: "act-2", title: "Act 2 — Solution"},
    {key: "act-3", title: "Act 3 — Lesson"},
    {key: "legacy", title: "Previous generations (legacy)"},
  ];
  let any = false;
  for (const sec of sections) {
    const list = byAct[sec.key];
    if (!list.length) continue;
    any = true;
    const heading = document.createElement("h3");
    heading.textContent = `${sec.title} (${list.length})`;
    heading.style.marginTop = "16px";
    wrap.append(heading);
    const sorted = [...list].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    for (const v of sorted) wrap.append(versionCard(v, sec.title));
  }
  if (!any) {
    wrap.innerHTML = `<p class="muted">No images yet — Generate Prompts then Execute Prompt above. Each Execute generates 3 images (one per act).</p>`;
  }
}

// Prefill the 3 editable per-act prompt boxes (only those still empty).
function fillActPrompts(actPrompts) {
  if (!actPrompts) return;
  for (const act of ACTS) {
    const el = document.getElementById(`prompt-image-${act.key}`);
    if (el && !el.value && actPrompts[act.key]) el.value = actPrompts[act.key];
  }
}

async function loadStoryboard() {
  try {
    const data = await json(`${api}/projects/${pid()}/storyboard`);
    renderVersions(data.versions || []);
    fillActPrompts(data.act_prompts || {});
    if (data.image_model) {
      modelName = data.image_model;
      const el = document.getElementById("model-name");
      if (el) el.textContent = modelName;
    }
  } catch {}
}

async function loadProjectMeta() {
  try {
    const s = pid();
    const p = await json(`${api}/projects/${s}`);
    if (window.setCurrentProject) window.setCurrentProject(p.project_id || s, p.slug, p.title || s);
    const sbTitle = document.getElementById("sb-title");
    if (sbTitle) sbTitle.textContent = (p.title || s) + " (" + s + ")";
    let question = p.question || p.title || "";
    let answer = p.answer || "";
    if (!answer && p.topic && p.topic.indexOf("→") >= 0) {
      answer = p.topic.split("→").slice(1).join("→").trim();
    }
    const why = p.why || "";
    document.getElementById("qa-question").value = question;
    document.getElementById("qa-answer").value = answer;
    document.getElementById("qa-why").value = why;
    document.getElementById("qa-topic").textContent = "topic: " + (p.topic || p.title || "(untitled)");
    const notesEl = document.getElementById("sb-notes");
    if (notesEl) notesEl.value = p.notes || "";
    return p;
  } catch (err) {
    document.getElementById("prompt-status").textContent = "Failed to load project metadata: " + err.message;
  }
}

async function loadPromptTemplate() {
  try {
    const p = await json(`${api}/prompts/storyboard`);
    const obj = JSON.parse(p.raw);
    promptTemplate = {
      system: obj.system || "",
      user: obj.user || "",
      actPrompts: obj.act_prompts || {},
    };
    for (const act of ACTS) {
      const el = document.getElementById(`prompt-template-${act.key}`);
      if (el) el.value = promptTemplate.actPrompts[act.key] || "";
    }
    return promptTemplate;
  } catch (err) {
    document.getElementById("prompt-status").textContent = "Failed to load prompt template: " + err.message;
    return null;
  }
}

async function loadModel() {
  try {
    const h = await json("/healthz");
    modelName = h.storyboard_image_model || h.image_model || "(unknown)";
    document.getElementById("model-name").textContent = modelName;
  } catch {
    document.getElementById("model-name").textContent = "(unavailable)";
  }
}

function generatePrompt() {
  if (!promptTemplate || !promptTemplate.actPrompts) {
    document.getElementById("prompt-status").textContent = "Prompt templates not loaded yet.";
    return;
  }
  const q = document.getElementById("qa-question").value.trim() || "(no question set)";
  const a = document.getElementById("qa-answer").value.trim() || "(no answer set)";
  const w = document.getElementById("qa-why").value.trim() || "";
  const cur = window.currentProject() || {};
  const t = cur.topic || cur.title || "(untitled)";

  for (const act of ACTS) {
    const rendered = (promptTemplate.actPrompts[act.key] || "")
      .replace(/\{\{topic\}\}/g, t)
      .replace(/\{\{question\}\}/g, q)
      .replace(/\{\{answer\}\}/g, a)
      .replace(/\{\{why\}\}/g, w)
      .replace(/\{\{act_title\}\}/g, act.title)
      .replace(/\{\{act_role\}\}/g, act.role);
    const el = document.getElementById(`prompt-image-${act.key}`);
    if (el) el.value = rendered;
  }
  document.getElementById("prompt-status").textContent =
    "Per-act image prompts built from Question · Answer · Why. {{act_summary}}/{{act_script}} are filled from the project on Execute.";
}

async function executePrompt() {
  const s = pid();
  if (!s) return;
  const btn = document.getElementById("execute-prompt");
  const status = document.getElementById("execute-status");
  const actPrompts = {};
  let any = false;
  for (const act of ACTS) {
    const v = document.getElementById(`prompt-image-${act.key}`).value.trim();
    actPrompts[act.key] = v;
    if (v) any = true;
  }
  if (!any) {
    status.textContent = "Generate the image prompts first.";
    return;
  }
  const body = {
    act_prompts: actPrompts,
    question: document.getElementById("qa-question").value.trim(),
    answer: document.getElementById("qa-answer").value.trim(),
    why: document.getElementById("qa-why").value.trim(),
  };
  setLoading(btn, true);
  status.textContent = "Generating 3 storyboard images (one per act) with " + (modelName || "the image model") + "…";
  try {
    const res = await json(`${api}/projects/${s}/storyboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res && res.versions) renderVersions(res.versions);
    if (res && res.act_prompts) fillActPrompts(res.act_prompts);
    if (res && res.image_model) {
      modelName = res.image_model;
      document.getElementById("model-name").textContent = modelName;
    }
    document.getElementById("mm-link").classList.remove("hidden");
    if (res && res.image_error) {
      status.textContent = "Done with errors: " + res.image_error;
    } else {
      status.textContent = "Done — 3 images generated (one per act).";
    }
  } catch (err) {
    status.textContent = "Error: " + err.message;
  } finally {
    setLoading(btn, false);
  }
}

document.addEventListener("layout:ready", async () => {
  const s = pid();
  if (!s) return;
  document.getElementById("no-project").classList.add("hidden");
  document.getElementById("manager").classList.remove("hidden");
  const cur = window.currentProject();
  document.getElementById("sb-title").textContent = cur.title + " (" + s + ")";

  await loadProjectMeta();
  await loadPromptTemplate();
  loadModel();

  document.getElementById("generate-prompt").addEventListener("click", generatePrompt);
  document.getElementById("execute-prompt").addEventListener("click", executePrompt);

  document.getElementById("sb-notes-save").addEventListener("click", async () => {
    const btn = document.getElementById("sb-notes-save");
    const notes = document.getElementById("sb-notes").value;
    const status = document.getElementById("sb-notes-status");
    const orig = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;
    status.style.color = "";
    try {
      await json(`${api}/projects/${s}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
      status.textContent = "✓ Saved";
      status.style.color = "#6c8cff";
      btn.textContent = orig;
      btn.disabled = false;
      setTimeout(() => { status.textContent = ""; }, 4000);
    } catch (err) {
      status.textContent = "✗ Error: " + err.message;
      status.style.color = "#ff6b6b";
      btn.textContent = orig;
      btn.disabled = false;
    }
  });

  loadStoryboard().then(() => {
    if (document.querySelector("#sb-image-wrap img") || document.querySelector("#sb-image-wrap .panel")) {
      document.getElementById("mm-link").classList.remove("hidden");
    }
  });
});

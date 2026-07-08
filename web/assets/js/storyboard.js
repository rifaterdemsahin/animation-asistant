// Storyboard Creator: turn the project's Question/Answer/Why into 12-panel
// comic storyboard images via the Gemini nanobanana image model. Each
// generation is saved as a new version (never overwritten); all are shown.
const api = "/api";
const slug = () => (window.currentProject && window.currentProject() || {}).slug;

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

// Render every generated version as a gallery (newest first).
function renderVersions(versions) {
  const wrap = document.getElementById("sb-image-wrap");
  const count = document.getElementById("sb-count");
  if (count) count.textContent = versions && versions.length ? `(${versions.length})` : "";
  if (!versions || !versions.length) {
    wrap.innerHTML = `<p class="muted">No images yet — Generate Prompt then Execute Prompt above. Each generation is saved as a new version (none are overwritten).</p>`;
    return;
  }
  const sorted = [...versions].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  wrap.innerHTML = "";
  for (const v of sorted) {
    const url = `${api}/projects/${slug()}/raw/${v.file}`;
    const bust = url + (url.includes("?") ? "&" : "?") + "_t=" + encodeURIComponent(v.created_at || ("v" + v.id));
    const card = document.createElement("div");
    card.className = "panel";
    card.style.marginTop = "12px";
    card.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center">
        <strong>Version ${v.id}</strong>
        <span class="muted" style="font-size:12px">${escapeHtml(v.created_at || "")}${v.image_model ? " · " + escapeHtml(v.image_model) : ""}</span>
      </div>
      <img alt="storyboard v${v.id}" style="max-width:100%;border-radius:8px;border:1px solid var(--border);margin-top:8px;display:block">
      <details style="margin-top:6px"><summary class="muted" style="cursor:pointer;font-size:12px">Image prompt</summary>
        <pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;margin-top:6px;background:var(--panel-2);padding:8px;border-radius:6px;overflow:auto;max-height:240px">${escapeHtml(v.image_prompt || "")}</pre>
      </details>`;
    const img = card.querySelector("img");
    img.src = bust;
    img.onerror = () => { img.alt = "image not found"; img.removeAttribute("src"); img.style.border = "1px dashed var(--border)"; };
    wrap.append(card);
  }
}

async function loadStoryboard() {
  try {
    const data = await json(`${api}/projects/${slug()}/storyboard`);
    renderVersions(data.versions || []);
    if (data.image_prompt && !document.getElementById("prompt-image").value) {
      document.getElementById("prompt-image").value = data.image_prompt;
    }
    if (data.image_model) {
      modelName = data.image_model;
      const el = document.getElementById("model-name");
      if (el) el.textContent = modelName;
    }
  } catch {}
}

async function loadProjectMeta() {
  try {
    const s = slug();
    const p = await json(`${api}/projects/${s}`);
    // Adopt the project (refines the header title, e.g. when deep-linked via ?project=).
    if (window.setCurrentProject) window.setCurrentProject(s, p.title || s);
    const sbTitle = document.getElementById("sb-title");
    if (sbTitle) sbTitle.textContent = (p.title || s) + " (" + s + ")";
    // Fill Question / Answer / Why from the project. Fall back to related
    // fields for projects created before Q/A/Why were persisted: the title
    // holds the question and the topic holds "question → answer".
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
      image_prompt: obj.image_prompt || "",
    };
    document.getElementById("prompt-system").value = promptTemplate.image_prompt;
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
  if (!promptTemplate) {
    document.getElementById("prompt-status").textContent = "Prompt template not loaded yet.";
    return;
  }
  const q = document.getElementById("qa-question").value.trim() || "(no question set)";
  const a = document.getElementById("qa-answer").value.trim() || "(no answer set)";
  const w = document.getElementById("qa-why").value.trim() || "";
  const cur = window.currentProject() || {};
  const t = cur.topic || cur.title || "(untitled)";

  const rendered = (promptTemplate.image_prompt || "")
    .replace(/\{\{topic\}\}/g, t)
    .replace(/\{\{question\}\}/g, q)
    .replace(/\{\{answer\}\}/g, a)
    .replace(/\{\{why\}\}/g, w);

  document.getElementById("prompt-image").value = rendered;
  document.getElementById("prompt-status").textContent = "Image prompt built from Question · Answer · Why.";
}

async function executePrompt() {
  const s = slug();
  if (!s) return;
  const btn = document.getElementById("execute-prompt");
  const status = document.getElementById("execute-status");
  const imagePrompt = document.getElementById("prompt-image").value.trim();
  if (!imagePrompt) {
    status.textContent = "Generate the image prompt first.";
    return;
  }
  const body = {
    image_prompt: imagePrompt,
    question: document.getElementById("qa-question").value.trim(),
    answer: document.getElementById("qa-answer").value.trim(),
    why: document.getElementById("qa-why").value.trim(),
  };
  setLoading(btn, true);
  status.textContent = "Generating storyboard image with " + (modelName || "the image model") + "…";
  try {
    const res = await json(`${api}/projects/${s}/storyboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res && res.versions) renderVersions(res.versions);
    if (res && res.image_model) {
      modelName = res.image_model;
      document.getElementById("model-name").textContent = modelName;
    }
    document.getElementById("mm-link").classList.remove("hidden");
    status.textContent = res && res.image_error ? "Image error: " + res.image_error : "Done.";
  } catch (err) {
    status.textContent = "Error: " + err.message;
  } finally {
    setLoading(btn, false);
  }
}

document.addEventListener("layout:ready", async () => {
  const s = slug();
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

  loadStoryboard().then(() => {
    if (document.querySelector("#sb-image-wrap img") || document.querySelector("#sb-image-wrap .panel")) {
      document.getElementById("mm-link").classList.remove("hidden");
    }
  });
});

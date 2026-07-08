// Storyboard Creator: assemble acts + components into scenes via Gemini.
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

function renderStoryboard(sb) {
  const out = document.getElementById("sb-out");
  const img = document.getElementById("sb-image");
  const rawUrl = `${api}/projects/${slug()}/raw/storyboard/storyboard.png`;
  img.src = rawUrl;
  img.classList.remove("hidden");
  img.onerror = () => img.classList.add("hidden");

  out.innerHTML = "";
  const actsObj = (sb && sb.acts) || {};
  const order = [["act-1", "Act 1 — Problem"], ["act-2", "Act 2 — Solution"], ["act-3", "Act 3 — Lesson"]];
  let any = false;
  for (const [key, title] of order) {
    const scenes = (actsObj[key] && actsObj[key].scenes) || [];
    if (!scenes.length) continue;
    any = true;
    const sec = document.createElement("div");
    sec.className = "panel";
    sec.innerHTML = `<h3>${title}</h3>`;
    for (const sc of scenes) {
      const row = document.createElement("div");
      row.className = "act";
      row.innerHTML = `<h3>${escapeHtml(sc.scene_id || "")} · ${escapeHtml(String(sc.duration || ""))}s</h3>
        <pre>${escapeHtml(sc.description || "")}</pre>
        <div class="muted">beat: ${escapeHtml(sc.beat_ref || "")} · components: ${escapeHtml((sc.component_ids || []).join(", "))}</div>`;
      sec.append(row);
    }
    out.append(sec);
  }
  if (!any) out.innerHTML = `<p class="muted">Storyboard has no scenes.</p>`;
}

async function loadStoryboard() {
  try {
    const { storyboard } = await json(`${api}/projects/${slug()}/storyboard`);
    if (storyboard) renderStoryboard(storyboard);
  } catch {}
}

let projectQA = {};
let promptTemplate = null;

async function loadProjectMeta() {
  try {
    const p = await json(`${api}/projects/${slug()}`);
    projectQA = { question: p.question || "", answer: p.answer || "", why: p.why || "", topic: p.topic || "", title: p.title || "" };
    const qa = document.getElementById("qa-content");
    if (projectQA.question || projectQA.answer || projectQA.why) {
      let html = "";
      if (projectQA.question) html += `<div style="margin-bottom:8px"><strong>Problem:</strong> ${escapeHtml(projectQA.question)}</div>`;
      if (projectQA.answer) html += `<div style="margin-bottom:8px"><strong>Solution:</strong> ${escapeHtml(projectQA.answer)}</div>`;
      if (projectQA.why) html += `<div><strong>Why (pedagogical rationale):</strong> ${escapeHtml(projectQA.why)}</div>`;
      qa.innerHTML = html || "<span class=\"muted\">No Q&A metadata set — edit on Projects page.</span>";
    } else {
      qa.innerHTML = "<span class=\"muted\">No Q&A metadata set — edit on Projects page.</span>";
    }
    return p;
  } catch {
    document.getElementById("qa-content").innerHTML = "<span class=\"error\">Failed to load project metadata.</span>";
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
    return promptTemplate;
  } catch (err) {
    document.getElementById("prompt-status").textContent = "Failed to load prompt template: " + err.message;
    return null;
  }
}

function renderPrompt(vars) {
  if (!promptTemplate) return;
  const r = (s) => {
    return (s || "")
      .replace(/\{\{context\}\}/g, vars.context || "")
      .replace(/\{\{topic\}\}/g, vars.topic || "");
  };
  document.getElementById("prompt-system").value = r(promptTemplate.system);
  document.getElementById("prompt-user").value = r(promptTemplate.user);
  document.getElementById("prompt-image").value = r(promptTemplate.image_prompt);
}

function generatePrompt() {
  if (!promptTemplate) {
    document.getElementById("prompt-status").textContent = "Prompt template not loaded yet.";
    return;
  }
  const q = projectQA.question || "(no question set)";
  const a = projectQA.answer || "(no answer set)";
  const w = projectQA.why || "";
  const t = projectQA.topic || projectQA.title || "(untitled)";

  const context = `Problem: ${q}
Solution: ${a}
Why (pedagogical rationale): ${w}
Title: ${projectQA.title || t}
Topic: ${t}`;

  renderPrompt({ context, topic: t });
  document.getElementById("prompt-status").textContent = "Prompt built from project Q&A.";
}

async function executePrompt() {
  const s = slug();
  if (!s) return;
  const btn = document.getElementById("execute-prompt");
  const status = document.getElementById("prompt-status");
  setLoading(btn, true);
  status.textContent = "Generating storyboard...";
  try {
    await json(`${api}/projects/${s}/storyboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await loadStoryboard();
    document.getElementById("mm-link").classList.remove("hidden");
    status.textContent = "Storyboard generated.";
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

  document.getElementById("generate-prompt").addEventListener("click", generatePrompt);
  document.getElementById("execute-prompt").addEventListener("click", executePrompt);

  loadStoryboard().then(() => {
    document.getElementById("mm-link").classList.remove("hidden");
  });
});
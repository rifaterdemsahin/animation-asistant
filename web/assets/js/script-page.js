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

function selectedActs() {
  // Checkbox ids are sc-act-1/2/3; keep k as act-1/2/3 (used downstream).
  return ["act-1", "act-2", "act-3"].filter(k => {
    const el = document.getElementById("sc-" + k);
    return el && el.checked;
  });
}

let promptTemplate = null;
let outlineSummaries = {};
let storyboardPrompts = {};
let modelName = "";

async function loadProjectMeta() {
  try {
    const s = slug();
    const p = await json(`${api}/projects/${s}`);
    if (window.setCurrentProject) window.setCurrentProject(s, p.title || s);
    document.getElementById("sc-title").textContent = (p.title || s) + " (" + s + ")";

    document.getElementById("qa-question").value = p.question || p.title || "";
    document.getElementById("qa-answer").value = p.answer || "";
    document.getElementById("qa-why").value = p.why || "";
    document.getElementById("qa-topic").textContent = "topic: " + (p.topic || p.title || "(untitled)");
    storyboardPrompts = p.storyboard_prompts || {};
    return p;
  } catch (err) {
    document.getElementById("sc-status").textContent = "Failed to load project: " + err.message;
  }
}

async function loadOutline() {
  try {
    const data = await json(`${api}/projects/${slug()}/outline`);
    if (data.outline) {
      const acts = data.outline.acts || {};
      outlineSummaries = {};
      for (const [k, v] of Object.entries(acts)) {
        if (v.summary) outlineSummaries[k] = v.summary;
      }
      const parts = [];
      if (outlineSummaries["act-1"]) parts.push("Act 1: " + outlineSummaries["act-1"]);
      if (outlineSummaries["act-2"]) parts.push("Act 2: " + outlineSummaries["act-2"]);
      if (outlineSummaries["act-3"]) parts.push("Act 3: " + outlineSummaries["act-3"]);
      document.getElementById("qa-outline").textContent = parts.length ? "outline: " + parts.join(" | ") : "outline: none";
    }
  } catch {
    document.getElementById("qa-outline").textContent = "outline: not generated";
  }
}

async function loadPromptTemplate() {
  try {
    const p = await json(`${api}/prompts/script`);
    const obj = JSON.parse(p.raw);
    promptTemplate = { system: obj.system || "", user: obj.user || "" };
    document.getElementById("prompt-system").value = promptTemplate.system;
    document.getElementById("prompt-user").value = promptTemplate.user;
    return promptTemplate;
  } catch (err) {
    document.getElementById("sc-status").textContent = "Failed to load prompt template: " + err.message;
  }
}

async function loadModel() {
  try {
    const h = await json("/healthz");
    modelName = h.text_model || "google/gemini-2.5-flash";
    document.getElementById("model-name").textContent = modelName;
  } catch {
    document.getElementById("model-name").textContent = "(unavailable)";
  }
}

async function loadExistingScript() {
  try {
    const data = await json(`${api}/projects/${slug()}/script`);
    const acts = data.acts || {};
    const order = [["act-1", "Act 1 — 😱 Problem"], ["act-2", "Act 2 — 💡 Solution"], ["act-3", "Act 3 — 🎓 Lesson"]];
    const out = document.getElementById("script-out");
    let any = false;
    out.innerHTML = "";
    for (const [key, title] of order) {
      if (!acts[key]) continue;
      any = true;
      const div = document.createElement("div");
      div.className = "act";
      div.innerHTML = `<h3>${title}</h3><pre>${escapeHtml(acts[key])}</pre>`;
      out.append(div);
    }
    if (!any) out.innerHTML = `<p class="muted">No script yet — generate above.</p>`;
  } catch {}
}

function showPreview() {
  if (!promptTemplate) {
    document.getElementById("sc-status").textContent = "Prompt template not loaded.";
    return;
  }
  document.getElementById("prompt-preview").value =
    "[System]\n" + promptTemplate.system + "\n\n[User Template]\n" + promptTemplate.user;
  document.getElementById("sc-status").textContent = "Prompt template preview shown.";
}

function generatePrompt() {
  if (!promptTemplate) {
    document.getElementById("sc-status").textContent = "Prompt template not loaded.";
    return;
  }
  const q = document.getElementById("qa-question").value.trim();
  const w = document.getElementById("qa-why").value.trim() || "explain a key concept";
  const cur = window.currentProject() || {};
  const topic = cur.topic || cur.title || "(untitled)";

  const acts = selectedActs();
  if (!acts.length) {
    document.getElementById("sc-status").textContent = "Select at least one act.";
    return;
  }

  const actRole = { "act-1": "problem", "act-2": "solution", "act-3": "lesson" };
  const actPurpose = {
    "act-1": "Set up the world and the problem/pain that the audience experiences.",
    "act-2": "Introduce the solution and show how it works step by step.",
    "act-3": "The takeaway / moral / insight the audience should leave with.",
  };

  let sbCtx = "";
  if (storyboardPrompts && Object.keys(storyboardPrompts).length) {
    const sbLines = ["Storyboard image prompts (previously generated for this project):"];
    for (const ak of ["act-1", "act-2", "act-3"]) {
      if (storyboardPrompts[ak]) sbLines.push("=== " + ak + " (" + (actRole[ak] || "") + ") ===\n" + storyboardPrompts[ak]);
    }
    sbCtx = sbLines.join("\n") + "\n\n";
  }

  let text = "";
  for (const k of acts) {
    const summary = outlineSummaries[k] || q;
    const filled = (promptTemplate.user || "")
      .replace(/\{\{topic\}\}/g, topic)
      .replace(/\{\{act_key\}\}/g, k)
      .replace(/\{\{act_role\}\}/g, actRole[k] || "")
      .replace(/\{\{summary\}\}/g, summary)
      .replace(/\{\{purpose\}\}/g, actPurpose[k] || "")
      .replace(/\{\{storyboard_prompts\}\}/g, sbCtx);
    text += "=== " + k + " (" + actRole[k] + ") ===\n" + sbCtx + filled + "\n\n";
  }

  document.getElementById("prompt-preview").value = text;
  document.getElementById("sc-status").textContent = "Generated prompts for " + acts.length + " act(s).";
}

async function executePrompt() {
  const s = slug();
  if (!s) return;
  const acts = selectedActs();
  if (!acts.length) {
    document.getElementById("sc-status").textContent = "Select at least one act.";
    return;
  }

  const btn = document.getElementById("execute-prompt");
  const status = document.getElementById("sc-status");

  const question = document.getElementById("qa-question").value.trim();
  const answer = document.getElementById("qa-answer").value.trim();
  const why = document.getElementById("qa-why").value.trim();

  setLoading(btn, true);
  status.textContent = "Generating script with " + modelName + "…";

  try {
    const body = { acts, question, answer, why };
    await json(`${api}/projects/${s}/script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    status.textContent = "Script generated for " + acts.length + " act(s).";
    await loadExistingScript();
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

  await loadProjectMeta();
  await loadOutline();
  await loadPromptTemplate();
  loadModel();
  loadExistingScript();

  document.getElementById("preview-prompt").addEventListener("click", showPreview);
  document.getElementById("generate-prompt").addEventListener("click", generatePrompt);
  document.getElementById("execute-prompt").addEventListener("click", executePrompt);
});
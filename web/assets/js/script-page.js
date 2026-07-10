const api = "/api";
const pid = () => (window.currentProject && window.currentProject() || {}).project_id;

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
let storyboardImages = {};
let modelName = "";
let modelsInfo = {};
let deepseekConfigured = false;

async function loadProjectMeta() {
  try {
    const s = pid();
    const p = await json(`${api}/projects/${s}`);
    if (window.setCurrentProject) window.setCurrentProject(p.project_id || s, p.slug, p.title || s);
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
    const data = await json(`${api}/projects/${pid()}/outline`);
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
    const m = await json("/api/models");
    modelsInfo = m || {};
    modelName = m.text || "google/gemini-3.5-flash";
    deepseekConfigured = !!(m.deepseek && m.deepseek.configured);
    document.getElementById("model-name").textContent = modelName;
    refreshProviderUI();
  } catch {
    document.getElementById("model-name").textContent = "(unavailable)";
  }
}

function refreshProviderUI() {
  const sel = document.getElementById("sc-provider");
  const note = document.getElementById("sc-provider-note");
  if (!sel) return;
  if (sel.value === "deepseek" && !deepseekConfigured) {
    note.textContent = "⚠️ DeepSeek not configured (DEEPSEEK_API_KEY missing) — will use OpenRouter.";
    document.getElementById("model-name").textContent = modelName;
  } else if (sel.value === "deepseek") {
    note.textContent = "";
    document.getElementById("model-name").textContent = (modelsInfo.deepseek && modelsInfo.deepseek.model) || "deepseek-chat";
  } else {
    note.textContent = "";
    document.getElementById("model-name").textContent = modelName;
  }
}

async function loadStoryboardContext() {
  const wrap = document.getElementById("sb-context");
  try {
    const data = await json(`${api}/projects/${pid()}/storyboard`);
    const versions = data.versions || [];
    const actOrder = [
      {key: "act-1", title: "Act 1 — Problem"},
      {key: "act-2", title: "Act 2 — Solution"},
      {key: "act-3", title: "Act 3 — Lesson"},
    ];
    // Pick latest version per act (highest ID).
    const latestByAct = {};
    for (const v of versions) {
      if (!v.act) continue;
      if (!latestByAct[v.act] || v.id > latestByAct[v.act].id) latestByAct[v.act] = v;
    }
    storyboardImages = {};
    wrap.innerHTML = "";
    let any = false;
    for (const {key, title} of actOrder) {
      const v = latestByAct[key];
      if (!v) continue;
      any = true;
      const imgUrl = `${api}/projects/${pid()}/raw/${encodeURIComponent(v.file)}`;
      storyboardImages[key] = {url: imgUrl, prompt: v.image_prompt || "", file: v.file};
      const div = document.createElement("div");
      div.style.cssText = "flex:1;min-width:180px;max-width:320px;text-align:center";
      div.innerHTML = `
        <p style="font-size:12px;margin-bottom:4px"><strong>${escapeHtml(title)}</strong></p>
        <img src="${escapeHtml(imgUrl)}" alt="storyboard ${escapeHtml(key)}" style="max-width:100%;max-height:180px;border-radius:8px;border:1px solid var(--border);cursor:pointer;display:block;margin:0 auto">
        <details style="margin-top:4px"><summary class="muted" style="cursor:pointer;font-size:11px">Prompt</summary>
          <pre style="white-space:pre-wrap;word-break:break-word;font-size:10px;margin-top:4px;background:var(--panel-2);padding:6px;border-radius:4px;overflow:auto;max-height:120px;text-align:left">${escapeHtml(v.image_prompt || "(no prompt)")}</pre>
        </details>`;
      div.querySelector("img").onerror = function() {
        this.alt = "[image not found]";
        this.removeAttribute("src");
        this.style.border = "1px dashed var(--border)";
        this.style.padding = "20px";
      };
      wrap.append(div);
    }
    if (!any) wrap.innerHTML = `<p class="muted" style="width:100%">No storyboard images yet — generate one at <a href="/pages/storyboard.html">📋 Storyboard</a> first, then use them as visual reference here.</p>`;
  } catch {
    wrap.innerHTML = `<p class="muted" style="width:100%">Storyboard not available.</p>`;
  }
}

async function loadExistingScript() {
  try {
    const data = await json(`${api}/projects/${pid()}/script`);
    const acts = data.acts || {};
    const voiceover = data.voiceover || {};
    const versions = data.versions || {};
    const order = [["act-1", "Act 1 — 😱 Problem"], ["act-2", "Act 2 — 💡 Solution"], ["act-3", "Act 3 — 🎓 Lesson"]];
    const out = document.getElementById("script-out");
    const voOut = document.getElementById("voiceover-out");
    const vOut = document.getElementById("versions-out");
    let any = false;
    let anyVo = false;
    let anyVer = false;
    out.innerHTML = "";
    voOut.innerHTML = "";
    vOut.innerHTML = "";
    for (const [key, title] of order) {
      if (acts[key]) {
        any = true;
        const div = document.createElement("div");
        div.className = "act";
        div.innerHTML = `<h3>${title}</h3><pre>${escapeHtml(acts[key])}</pre>`;
        out.append(div);
      }
      if (voiceover[key]) {
        anyVo = true;
        const div = document.createElement("div");
        div.className = "act";
        div.innerHTML = `<h3>${title}</h3><pre>${escapeHtml(voiceover[key])}</pre>`;
        voOut.append(div);
      }
      if (versions[key] && versions[key].length) {
        anyVer = true;
        const heading = document.createElement("h3");
        heading.textContent = `${title} (${versions[key].length})`;
        heading.style.marginTop = "12px";
        vOut.append(heading);
        const sorted = [...versions[key]].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        for (const v of sorted) vOut.append(versionCard(v, title));
      }
    }
    if (!any) out.innerHTML = `<p class="muted">No script yet — generate above.</p>`;
    if (!anyVo) voOut.innerHTML = `<p class="muted">No voiceover yet — generate the script above first.</p>`;
    if (!anyVer) vOut.innerHTML = `<p class="muted">No versions yet — generate the script above.</p>`;
  } catch {}
}

function versionCard(v, actTitle) {
  const card = document.createElement("div");
  card.className = "panel";
  card.style.marginTop = "8px";
  card.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center">
      <strong>${escapeHtml(actTitle || "")} · v${v.id}</strong>
      <span class="muted" style="font-size:12px">${escapeHtml(v.created_at || "")}${v.model ? " · " + escapeHtml(v.model) : ""}</span>
    </div>
    <details style="margin-top:4px"><summary class="muted" style="cursor:pointer;font-size:12px">Markdown Script</summary>
      <pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;margin-top:6px;background:var(--panel-2);padding:8px;border-radius:6px;overflow:auto;max-height:240px">${escapeHtml(v.markdown || "(no markdown)")}</pre>
    </details>
    <details style="margin-top:4px"><summary class="muted" style="cursor:pointer;font-size:12px">Voiceover (TTS-ready)</summary>
      <pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;margin-top:6px;background:var(--panel-2);padding:8px;border-radius:6px;overflow:auto;max-height:240px">${escapeHtml(v.voiceover || "(no voiceover)")}</pre>
    </details>
    <div class="row" style="margin-top:8px;gap:8px">
      <button class="btn sv-copy-btn">📋 Copy Voiceover</button>
      <span class="muted sv-copy-status" style="font-size:12px;display:none"></span>
    </div>`;

  card.querySelector(".sv-copy-btn").addEventListener("click", async () => {
    const text = v.voiceover || v.markdown || "";
    const statusEl = card.querySelector(".sv-copy-status");
    try {
      const label = actTitle ? actTitle + " — v" + v.id : "v" + v.id;
      await navigator.clipboard.writeText(label + "\n\n" + text);
      statusEl.textContent = "Copied!";
      statusEl.style.display = "";
      setTimeout(() => { statusEl.style.display = "none"; }, 2000);
    } catch (err) {
      statusEl.textContent = "Copy failed.";
      statusEl.style.display = "";
      setTimeout(() => { statusEl.style.display = "none"; }, 3000);
    }
  });

  return card;
}

function showPreview() {
  if (!promptTemplate) {
    document.getElementById("sc-status").textContent = "Prompt template not loaded.";
    return;
  }
  generatePrompt();
  document.getElementById("sc-status").textContent += " (with storyboard context)";
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
    const sbLines = ["### STORYBOARD IMAGES FOR THIS ACT", "The narration must describe what the audience sees in these images. Match visual elements, composition, and style precisely.", ""];
    for (const ak of ["act-1", "act-2", "act-3"]) {
      const lines = [];
      if (storyboardPrompts[ak]) lines.push("**" + ak + " (" + (actRole[ak] || "") + "):** " + storyboardPrompts[ak]);
      if (storyboardImages[ak]) lines.push("Image file: " + storyboardImages[ak].file);
      if (lines.length) sbLines.push(lines.join("\n"));
    }
    sbCtx = sbLines.join("\n") + "\n";
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
      .replace(/\{\{storyboard_prompts\}\}/g, "");
    text += "=== " + k + " (" + actRole[k] + ") ===\n" + (sbCtx || "") + filled + "\n\n";
  }

  document.getElementById("prompt-preview").value = text;
  document.getElementById("sc-status").textContent = "Prompt for " + acts.length + " act(s)" + (sbCtx ? " + storyboard context" : "") + " — ready to Execute.";
}

async function executePrompt() {
  const s = pid();
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
  const provider = (document.getElementById("sc-provider") || {}).value || "openrouter";
  const useModel = provider === "deepseek" ? ((modelsInfo.deepseek && modelsInfo.deepseek.model) || "deepseek-chat") : modelName;
  status.textContent = "Generating script with " + useModel + "…";

  try {
    const body = { acts, question, answer, why, provider: (document.getElementById("sc-provider") || {}).value || "openrouter" };
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

async function copyVoiceover() {
  try {
    const voOut = document.getElementById("voiceover-out");
    const pres = voOut.querySelectorAll("pre");
    if (!pres.length) {
      document.getElementById("copy-status").textContent = "Nothing to copy.";
      return;
    }
    const order = ["Act 1 — Problem", "Act 2 — Solution", "Act 3 — Lesson"];
    let text = "";
    let i = 0;
    for (const pre of pres) {
      text += (order[i] || "") + "\n\n" + pre.textContent.trim() + "\n\n";
      i++;
    }
    await navigator.clipboard.writeText(text.trim());
    document.getElementById("copy-status").textContent = "Copied!";
    setTimeout(() => { document.getElementById("copy-status").textContent = ""; }, 2000);
  } catch (err) {
    document.getElementById("copy-status").textContent = "Copy failed.";
  }
}

document.addEventListener("layout:ready", async () => {
  const s = pid();
  if (!s) return;
  document.getElementById("no-project").classList.add("hidden");
  document.getElementById("manager").classList.remove("hidden");

  await loadProjectMeta();
  await loadOutline();
  await loadStoryboardContext();
  await loadPromptTemplate();
  loadModel();
  loadExistingScript();

  document.getElementById("preview-prompt").addEventListener("click", showPreview);
  document.getElementById("generate-prompt").addEventListener("click", generatePrompt);
  document.getElementById("execute-prompt").addEventListener("click", executePrompt);
  document.getElementById("copy-voiceover").addEventListener("click", copyVoiceover);
  const prov = document.getElementById("sc-provider");
  if (prov) prov.addEventListener("change", refreshProviderUI);
});
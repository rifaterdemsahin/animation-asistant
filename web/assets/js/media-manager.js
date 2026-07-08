var api = "/api";
var slug = function () { return (window.currentProject && window.currentProject() || {}).slug; };

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
async function j(url, opts) { var r = await fetch(url, { credentials: "same-origin", ...opts }); if (!r.ok) throw new Error((await r.text()) || r.statusText); return r.json(); }
function loading(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.label = btn.textContent; btn.textContent = "Working…"; } else if (btn.dataset.label) btn.textContent = btn.dataset.label; }
function acts() { return ["act-1","act-2","act-3"].filter(function (k) { return document.getElementById(k).checked; }); }

function togglePrompt(btnId, preId, text) {
  document.getElementById(btnId).addEventListener("click", function () {
    var pre = document.getElementById(preId);
    if (pre.classList.contains("hidden")) { pre.textContent = text; pre.classList.remove("hidden"); }
    else pre.classList.add("hidden");
  });
}

async function loadStoryboardImg() {
  var s = slug();
  try {
    var sb = await j(api + "/projects/" + s + "/storyboard");
    var file = "";
    if (sb.versions && sb.versions.length) {
      var latest = sb.versions[sb.versions.length - 1];
      for (var i = 0; i < sb.versions.length; i++) {
        if (!latest || (sb.versions[i].id || 0) > (latest.id || 0)) latest = sb.versions[i];
      }
      file = latest ? latest.file : "";
    } else if (sb.storyboard) {
      file = "storyboard/storyboard.png";
    }
    if (file) {
      document.getElementById("storyboard-preview").classList.remove("hidden");
      var img = document.getElementById("sb-preview-img");
      img.src = api + "/projects/" + s + "/raw/" + file;
      img.onerror = function () { document.getElementById("storyboard-preview").classList.add("hidden"); };
    }
  } catch {}
}

async function loadOutline() {
  try {
    var r = await j(api + "/projects/" + slug() + "/outline");
    if (r.outline) { document.getElementById("outline-out").textContent = JSON.stringify(r.outline, null, 2); document.getElementById("outline-out").classList.remove("hidden"); document.getElementById("outline-state").textContent = "✅ ready"; }
  } catch {}
}

function renderScripts(acts) {
  var out = document.getElementById("script-out"); out.innerHTML = "";
  var order = [["act-1","Act 1 — 😱 Problem"],["act-2","Act 2 — 💡 Solution"],["act-3","Act 3 — 🎓 Lesson"]];
  var any = false;
  for (var i = 0; i < order.length; i++) { var k = order[i][0], t = order[i][1]; if (!acts[k]) continue; any = true; var d = document.createElement("div"); d.className = "act"; d.innerHTML = "<h3>" + t + "</h3><pre>" + esc(acts[k]) + "</pre>"; out.append(d); }
  if (!any) out.innerHTML = "<p class='muted'>No script yet — generate one above.</p>";
}
async function loadScript() { try { var r = await j(api + "/projects/" + slug() + "/script"); renderScripts(r.acts || {}); } catch {} }

function renderComponents(acts) {
  var out = document.getElementById("components-out"); out.innerHTML = "";
  var order = [["act-1","Act 1"],["act-2","Act 2"],["act-3","Act 3"]];
  var any = false;
  for (var i = 0; i < order.length; i++) { var k = order[i][0], t = order[i][1]; var l = acts[k] || []; if (!l.length) continue; any = true;
    var s = document.createElement("div"); s.className = "panel"; s.innerHTML = "<h3>" + t + "</h3>";
    var g = document.createElement("div"); g.className = "grid";
    for (var jj = 0; jj < l.length; jj++) { var c = l[jj]; var card = document.createElement("div"); card.className = "comp"; card.innerHTML = "<img loading='lazy' src='" + api + "/projects/" + slug() + "/raw/" + c.file + "' alt='" + esc(c.type) + "'><div class='comp-meta'><span class='badge'>" + esc(c.type) + "</span><span class='muted'>" + esc(c.script_ref||"") + "</span></div><div class='comp-prompt muted' style='font-size:10px'>" + esc(c.prompt||"") + "</div>"; g.append(card); }
    s.append(g); out.append(s);
  }
  if (!any) out.innerHTML = "<p class='muted'>No components yet — generate above.</p>";
}
async function loadComponents() { try { var r = await j(api + "/projects/" + slug() + "/components"); renderComponents(r.acts || {}); } catch {} }

function renderAudio(audio) {
  var out = document.getElementById("audio-out"); out.innerHTML = "";
  var order = [["act-1","Act 1 — 😱 Problem"],["act-2","Act 2 — 💡 Solution"],["act-3","Act 3 — 🎓 Lesson"]];
  var any = false;
  for (var i = 0; i < order.length; i++) { var k = order[i][0], t = order[i][1]; if (!audio[k]) continue; any = true; var d = document.createElement("div"); d.className = "act"; d.innerHTML = "<h3>" + t + "</h3>🎙️ <audio controls src='" + api + "/projects/" + slug() + "/raw/" + audio[k] + "'></audio>"; out.append(d); }
  if (!any) out.innerHTML = "<p class='muted'>No audio yet — generate above.</p>";
}
async function loadAudio() { try { var r = await j(api + "/projects/" + slug() + "/audio"); renderAudio(r.audio || {}); } catch {} }

async function loadBrowse() {
  var out = document.getElementById("files-out");
  try {
    var r = await j(api + "/projects/" + slug() + "/browse"); var f = r.files || [];
    if (!f.length) { out.innerHTML = "<p class='muted'>No files generated yet.</p>"; return; }
    out.innerHTML = f.map(function (x) {
      if (x.type === "image") return "<div class='file-card'><img loading='lazy' src='" + x.url + "' alt='" + x.path + "'><div class='file-meta'><a href='" + x.url + "' target='_blank'>🖼️ " + x.path + "</a></div></div>";
      if (x.type === "audio") return "<div class='file-card'>🎧 <audio controls src='" + x.url + "'></audio><div class='file-meta'><a href='" + x.url + "' target='_blank'>🎵 " + x.path + "</a></div></div>";
      return "<div class='file-card'><div class='file-icon'>📄</div><div class='file-meta'><a href='" + x.url + "' target='_blank'>" + x.path + "</a></div></div>";
    }).join("");
  } catch { out.innerHTML = "<p class='muted'>Could not load files.</p>"; }
}

document.addEventListener("layout:ready", function () {
  var s = slug(); if (!s) return;
  document.getElementById("no-project").classList.add("hidden");
  document.getElementById("manager").classList.remove("hidden");
  var cur = window.currentProject();
  document.getElementById("mm-title").textContent = cur.title + " (" + s + ")";
  document.getElementById("mm-status").textContent = cur.slug;

  var allPrompts = null;

  async function loadProjectQA() {
    try {
      var p = await j(api + "/projects/" + s);
      var ctx = [];
      if (p.question_id) ctx.push("Question ID: " + p.question_id);
      if (p.type) ctx.push("Type: " + p.type);
      if (p.question) ctx.push("Problem: " + p.question);
      if (p.answer) ctx.push("Solution: " + p.answer);
      if (p.why) ctx.push("Why: " + p.why);
      document.getElementById("prompt-context").textContent = ctx.length ? ctx.join(" | ") : "No Q&A metadata — edit on Projects page.";
      return p;
    } catch { return null; }
  }

  async function loadAllPrompts() {
    if (allPrompts) return allPrompts;
    var ids = ["outline", "script", "components", "storyboard"];
    allPrompts = {};
    for (var i = 0; i < ids.length; i++) {
      try {
        var r = await j(api + "/prompts/" + ids[i]);
        allPrompts[ids[i]] = JSON.parse(r.raw);
      } catch {}
    }
    return allPrompts;
  }

  document.getElementById("prompt-view-btn").addEventListener("click", async function () {
    var pre = document.getElementById("prompt-output");
    var status = document.getElementById("prompt-status");
    if (!pre.classList.contains("hidden")) {
      pre.classList.add("hidden");
      status.textContent = "";
      return;
    }
    status.textContent = "Loading prompts...";
    try {
      var prompts = await loadAllPrompts();
      var text = "";
      for (var id in prompts) {
        var p = prompts[id];
        text += "=== " + id.toUpperCase() + " ===\n";
        if (p.system) text += "[System]\n" + p.system + "\n\n";
        if (p.user) text += "[User]\n" + p.user + "\n\n";
        if (p.image_prompt) text += "[Image]\n" + p.image_prompt + "\n\n";
      }
      pre.textContent = text || "No prompts loaded.";
      pre.classList.remove("hidden");
      status.textContent = "All prompt templates viewed.";
    } catch (err) {
      status.textContent = "Error: " + err.message;
    }
  });

  document.getElementById("prompt-gen-btn").addEventListener("click", async function () {
    var status = document.getElementById("prompt-status");
    status.textContent = "Fetching project data...";
    try {
      var proj = await loadProjectQA();
      var prompts = await loadAllPrompts();
      if (!proj) { status.textContent = "Could not load project."; return; }
      var q = proj.question || "(no question set)";
      var a = proj.answer || "(no answer set)";
      var w = proj.why || "";
      var context = "Problem: " + q + "\nSolution: " + a + "\nWhy: " + w + "\nTitle: " + (proj.title || cur.title) + "\nTopic: " + (proj.topic || cur.title);

      var fill = function (s) {
        return (s || "")
          .replace(/\{\{topic\}\}/g, proj.topic || cur.title)
          .replace(/\{\{context\}\}/g, context)
          .replace(/\{\{component_type\}\}/g, proj.component_type || "explainer")
          .replace(/\{\{summary\}\}/g, q)
          .replace(/\{\{purpose\}\}/g, w)
          .replace(/\{\{act_key\}\}/g, "act-1")
          .replace(/\{\{act_role\}\}/g, "problem");
      };

      var text = "";
      for (var id in prompts) {
        var p = prompts[id];
        text += "=== " + id.toUpperCase() + " ===\n";
        if (p.system) text += "[System]\n" + fill(p.system) + "\n\n";
        if (p.user) text += "[User]\n" + fill(p.user) + "\n\n";
        if (p.image_prompt) text += "[Image]\n" + fill(p.image_prompt) + "\n\n";
      }
      document.getElementById("prompt-output").textContent = text;
      document.getElementById("prompt-output").classList.remove("hidden");
      status.textContent = "Prompts filled with project Q&A.";
    } catch (err) {
      status.textContent = "Error: " + err.message;
    }
  });

  document.getElementById("prompt-exec-btn").addEventListener("click", async function (e) {
    var btn = e.currentTarget;
    var status = document.getElementById("prompt-status");
    loading(btn, true);

    async function step(name, fn) { status.textContent = "Running: " + name + "..."; await fn(); status.textContent = name + " done."; }

    try {
      await step("outline", async function () {
        await j(api + "/projects/" + s + "/outline", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        document.getElementById("outline-out").classList.remove("hidden");
        loadOutline();
      });
      await step("script (3 acts)", async function () {
        await j(api + "/projects/" + s + "/script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: ["act-1","act-2","act-3"] }) });
        loadScript();
      });
      await step("components (3 acts)", async function () {
        await j(api + "/projects/" + s + "/components", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: ["act-1","act-2","act-3"] }) });
        loadComponents();
      });
      await step("audio (3 acts)", async function () {
        await j(api + "/projects/" + s + "/audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: ["act-1","act-2","act-3"] }) });
        loadAudio();
      });
      status.textContent = "Full pipeline complete.";
      loadBrowse();
    } catch (err) {
      status.textContent = "Error: " + err.message;
    } finally {
      loading(btn, false);
    }
  });

  loadProjectQA();

  togglePrompt("show-outline-prompt", "outline-prompt",
    "System: You design short animated explainer video outlines using a STRICT 3-act structure: Act 1 = Problem, Act 2 = Solution, Act 3 = Lesson. You return JSON only, no markdown.\n\n" +
    "User: Topic: " + cur.title + "\nComponent type: explainer\n\nProduce a JSON object with this exact shape:\n{\"title\":\"short title\",\"logline\":\"one sentence\",\"acts\":{\"act-1\":{\"summary\":\"...\"},\"act-2\":{\"summary\":\"...\"},\"act-3\":{\"summary\":\"...\"}}}\nEach act summary must be 1-2 sentences fitting the act's role. JSON only.");

  togglePrompt("show-script-prompt", "script-prompt",
    "System: You are a scriptwriter for short animated explainer videos. You write ONE act and return STRICT JSON only, no markdown.\n\n" +
    "User: Topic: " + cur.title + "\nAct: act-1 (problem)\nOutline summary for this act: <from outline>\n\n" +
    "Write only this act. Return JSON with shape:\n{\"narration\":\"1-3 paragraphs\",\"beats\":[{\"id\":\"beat-1\",\"text\":\"one concrete beat\"}]}\n3 to 6 beats. JSON only.");

  togglePrompt("show-comp-prompt", "comp-prompt",
    "Image model: google/gemini-3.5-flash-image\nPrompt per type:\n• background: 'wide 16:9 background scene illustration, clean flat vector style, no text. Illustrate this idea: <beat>. Topic: " + cur.title + ". Flat vector, clean.'\n• lower-third: 'lower-third banner overlay graphic with space for a short caption, flat vector, minimal.'\n• speech-bubble: 'speech bubble graphic with space for a short quote, flat vector, clean.'\n• infographic: 'clean infographic with simple data visualization using icons and numbers, flat vector.'\nDefaults: 4 types × 3 acts = 12 images.");

  togglePrompt("show-audio-prompt", "audio-prompt",
    "ElevenLabs TTS\nVoice: George (warm storyteller)\nModel: eleven_turbo_v2_5\nInput: act narration text from script generation.");

  document.getElementById("gen-outline").addEventListener("click", async function (e) { var b = e.currentTarget; loading(b, true); try { var r = await j(api + "/projects/" + s + "/outline", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); document.getElementById("outline-out").textContent = JSON.stringify(r.outline, null, 2); document.getElementById("outline-out").classList.remove("hidden"); document.getElementById("outline-state").textContent = "✅ ready"; } catch (err) { alert(err.message); } finally { loading(b, false); } });
  document.getElementById("gen-script").addEventListener("click", async function (e) { var b = e.currentTarget; var a = acts(); if (!a.length) { alert("Select at least one act."); return; } loading(b, true); try { await j(api + "/projects/" + s + "/script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: a }) }); await loadScript(); } catch (err) { alert(err.message); } finally { loading(b, false); } });
  document.getElementById("gen-components").addEventListener("click", async function (e) { var b = e.currentTarget; var a = acts(); if (!a.length) { alert("Select at least one act."); return; } loading(b, true); try { await j(api + "/projects/" + s + "/components", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: a }) }); await loadComponents(); } catch (err) { alert(err.message); } finally { loading(b, false); } });
  document.getElementById("gen-audio").addEventListener("click", async function (e) { var b = e.currentTarget; var a = acts(); if (!a.length) { alert("Select at least one act."); return; } loading(b, true); try { await j(api + "/projects/" + s + "/audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: a }) }); await loadAudio(); } catch (err) { alert(err.message); } finally { loading(b, false); } });
  document.getElementById("refresh-files").addEventListener("click", function () { loadBrowse(); });

  loadStoryboardImg(); loadOutline(); loadScript(); loadComponents(); loadAudio(); loadBrowse();
});

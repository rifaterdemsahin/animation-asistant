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

var compTmpl = null;     // components prompt template: {default_types, styles, image_prompt}
var beatsByAct = {};     // actKey -> [beat text,...] from the latest script version
var compTopic = "";

function renderCompPrompt(tmpl, style, beat, topic) {
  return (tmpl || "{{style}}. Illustrate this idea: {{beat}}. Topic: {{topic}}. Flat vector, clean, consistent style.")
    .replace(/\{\{style\}\}/g, style)
    .replace(/\{\{beat\}\}/g, beat)
    .replace(/\{\{topic\}\}/g, topic);
}

// Loads the components template, the latest per-act script beats, and the topic
// so each component card can show the exact prompt that will be (or was) sent.
async function ensureCompData() {
  var s = slug();
  var jobs = [];
  if (!compTmpl) jobs.push(j(api + "/prompts/components").then(function (r) { compTmpl = JSON.parse(r.raw); }));
  if (!Object.keys(beatsByAct).length) jobs.push(j(api + "/projects/" + s + "/script").then(function (r) {
    beatsByAct = {};
    var vers = r.versions || {};
    for (var act in vers) {
      var arr = vers[act] || []; var latest = null;
      for (var i = 0; i < arr.length; i++) if (!latest || (arr[i].id || 0) > (latest.id || 0)) latest = arr[i];
      if (!latest || !latest.beats) continue;
      try { var parsed = JSON.parse(latest.beats); var texts = [];
        for (var b = 0; b < parsed.length; b++) texts.push((parsed[b] && parsed[b].text) || "");
        beatsByAct[act] = texts;
      } catch (e) {}
    }
  }).catch(function () {}));
  if (!compTopic) jobs.push(j(api + "/projects/" + s).then(function (p) { compTopic = p.topic || p.title || s; }).catch(function () {}));
  if (jobs.length) await Promise.all(jobs);
  return compTmpl;
}

function renderComponents(actsObj) {
  var out = document.getElementById("components-out"); out.innerHTML = "";
  var types = (compTmpl && compTmpl.default_types) || ["background", "lower-third", "speech-bubble", "infographic"];
  var styles = (compTmpl && compTmpl.styles) || {};
  var imgTmpl = (compTmpl && compTmpl.image_prompt) || "";
  var topic = compTopic || (window.currentProject() || {}).title || "";
  var s = slug();
  var order = [["act-1", "Act 1 — 😱 Problem"], ["act-2", "Act 2 — 💡 Solution"], ["act-3", "Act 3 — 🎓 Lesson"]];

  for (var oi = 0; oi < order.length; oi++) {
    var key = order[oi][0], title = order[oi][1];
    var existing = actsObj[key] || [];
    var byType = {};
    for (var e = 0; e < existing.length; e++) if (existing[e] && existing[e].type) byType[existing[e].type] = existing[e];

    var wrap = document.createElement("div"); wrap.className = "panel"; wrap.style.marginTop = "12px";
    wrap.innerHTML = "<h3>" + title + "</h3>";
    var grid = document.createElement("div"); grid.className = "grid";

    for (var ti = 0; ti < types.length; ti++) {
      (function (actKey, t, idx) {
        var entry = byType[t] || {};
        var style = styles[t] || t;
        // Same fallback order as the backend beatAt(): beat[idx] -> beat[0] -> topic.
        var beatText = (beatsByAct[actKey] && beatsByAct[actKey][idx]) || (beatsByAct[actKey] && beatsByAct[actKey][0]) || topic;
        var preview = entry.prompt || renderCompPrompt(imgTmpl, style, beatText, topic);

        var card = document.createElement("div"); card.className = "comp";
        var imgHtml = entry.file
          ? "<img loading='lazy' src='" + api + "/projects/" + s + "/raw/" + entry.file + "' alt='" + esc(t) + "'>"
          : "<div class='comp-placeholder muted'>— not generated yet —</div>";
        card.innerHTML =
          imgHtml +
          "<div class='comp-meta'>" +
            "<span class='badge'>" + esc(t) + (entry.script_ref ? " · " + esc(entry.script_ref) : "") + "</span>" +
            "<div class='row' style='gap:6px'>" +
              "<button class='btn comp-show'>👁️ Prompt</button>" +
              "<button class='btn primary comp-gen'>⚡ Generate</button>" +
            "</div>" +
            "<pre class='comp-prompt-out out hidden' style='font-size:10px;max-height:120px;overflow:auto;margin:6px 0 0'>" + esc(preview) + "</pre>" +
          "</div>";
        grid.append(card);

        var pre = card.querySelector(".comp-prompt-out");
        card.querySelector(".comp-show").addEventListener("click", function () { pre.classList.toggle("hidden"); });
        card.querySelector(".comp-gen").addEventListener("click", function (e2) {
          var b = e2.currentTarget; loading(b, true);
          j(api + "/projects/" + s + "/components", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: [actKey], types: [t] }) })
            .then(function () { return loadComponents(); })
            .catch(function (err) { alert(err.message); })
            .finally(function () { loading(b, false); });
        });
      })(key, types[ti], ti);
    }
    wrap.append(grid); out.append(wrap);
  }

  var hasAny = false; for (var ak in actsObj) if ((actsObj[ak] || []).length) { hasAny = true; break; }
  if (!hasAny) { var note = document.createElement("p"); note.className = "muted"; note.textContent = "No components yet — click a per-card Generate, or Generate all components above."; out.prepend(note); }
}
async function loadComponents() { try { var r = await j(api + "/projects/" + slug() + "/components"); await ensureCompData(); renderComponents(r.acts || {}); } catch {} }

function renderAudio(audio) {
  var out = document.getElementById("audio-out"); out.innerHTML = "";
  var order = [["act-1","Act 1 — 😱 Problem"],["act-2","Act 2 — 💡 Solution"],["act-3","Act 3 — 🎓 Lesson"]];
  var any = false;
  for (var i = 0; i < order.length; i++) { var k = order[i][0], t = order[i][1]; if (!audio[k]) continue; any = true; var d = document.createElement("div"); d.className = "act"; d.innerHTML = "<h3>" + t + "</h3>🎙️ <audio controls src='" + api + "/projects/" + slug() + "/raw/" + audio[k] + "'></audio>"; out.append(d); }
  if (!any) out.innerHTML = "<p class='muted'>No audio yet — generate above.</p>";
}
async function loadAudio() { try { var r = await j(api + "/projects/" + slug() + "/audio"); renderAudio(r.audio || {}); } catch {} }

// --- Generated-file browser: download, copy-to-clipboard, modal preview ---

function fileName(path) { var i = String(path).lastIndexOf("/"); return i >= 0 ? path.slice(i + 1) : path; }
function fullUrl(u) { try { return new URL(u, window.location.origin).href; } catch { return u; } }
function typeIcon(t) { return t === "image" ? "🖼️" : t === "audio" ? "🎧" : t === "json" ? "🔧" : t === "markdown" ? "📝" : "📄"; }
function flash(btn, msg, ok) {
  if (!btn) return;
  var old = btn.textContent;
  btn.textContent = ok ? "✅ " + msg : "❌ failed";
  setTimeout(function () { btn.textContent = old; }, 1500);
}

async function fetchBlob(url) {
  var r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.blob();
}

async function downloadAsset(file) {
  try {
    var blob = await fetchBlob(file.url);
    var obj = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = obj; a.download = fileName(file.path);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(obj); }, 1500);
  } catch (err) { alert("Download failed: " + err.message); }
}

// Context-aware copy: images -> image data in clipboard; text-like -> text; else -> URL.
async function copyAsset(file, btn) {
  try {
    if (file.type === "image" && navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
      var blob = await fetchBlob(file.url);
      var mime = (blob.type && blob.type.indexOf("image/") === 0) ? blob.type : "image/png";
      var item = {}; item[mime] = blob;
      await navigator.clipboard.write([new ClipboardItem(item)]);
      flash(btn, "Image copied", true); return;
    }
    if (file.type === "json" || file.type === "markdown") {
      var txt = await fetch(file.url, { credentials: "same-origin" }).then(function (r) { return r.text(); });
      await navigator.clipboard.writeText(txt);
      flash(btn, "Text copied", true); return;
    }
    await navigator.clipboard.writeText(fullUrl(file.url));
    flash(btn, "URL copied", true);
  } catch (err) {
    // Fallback for everything (incl. audio, which has no clipboard format): copy the URL.
    try { await navigator.clipboard.writeText(fullUrl(file.url)); flash(btn, "URL copied", true); }
    catch (e2) { flash(btn, err.message || "failed", false); }
  }
}

function openAssetModal(file) {
  var existing = document.getElementById("asset-modal"); if (existing) existing.remove();
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay"; overlay.id = "asset-modal";
  var name = fileName(file.path);
  var icon = typeIcon(file.type);

  var preview = "";
  if (file.type === "image") preview = "<img src='" + file.url + "' alt='" + esc(name) + "' style='max-width:100%;border-radius:8px;display:block;margin:0 auto'>";
  else if (file.type === "audio") preview = "<audio controls src='" + file.url + "' style='width:100%'></audio>";
  else if (file.type === "json" || file.type === "markdown") preview = "<pre id='am-text' class='out' style='max-height:50vh;overflow:auto'></pre>";
  else preview = "<div style='text-align:center;font-size:56px;line-height:1.5'>" + icon + "</div>";

  overlay.innerHTML =
    "<div class='modal' style='max-width:780px'>" +
      "<div class='modal-header'><h2>" + icon + " " + esc(name) + " <span class='badge'>" + esc(file.type) + "</span></h2>" +
        "<button class='modal-close' id='am-close'>&times;</button></div>" +
      "<div class='modal-body'>" +
        "<div class='section' id='am-preview'>" + preview + "</div>" +
        "<div class='section'><h3>Path</h3><code style='word-break:break-all;font-size:12px'>" + esc(file.path) + "</code></div>" +
        "<div class='section'><h3>URL</h3><code style='word-break:break-all;font-size:12px'>" + esc(fullUrl(file.url)) + "</code></div>" +
      "</div>" +
      "<div class='modal-footer'>" +
        "<button class='btn' id='am-copy-url'>🔗 Copy URL</button>" +
        "<button class='btn' id='am-copy'>📋 Copy</button>" +
        "<button class='btn primary' id='am-download'>⬇️ Download</button>" +
      "</div>" +
    "</div>";

  document.body.appendChild(overlay);
  var close = function () { overlay.remove(); };
  overlay.querySelector("#am-close").addEventListener("click", close);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function onEsc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); } });

  overlay.querySelector("#am-download").addEventListener("click", function () { downloadAsset(file); });
  overlay.querySelector("#am-copy").addEventListener("click", function (e) { copyAsset(file, e.currentTarget); });
  overlay.querySelector("#am-copy-url").addEventListener("click", function (e) {
    navigator.clipboard.writeText(fullUrl(file.url)).then(function () { flash(e.currentTarget, "Copied", true); }).catch(function (er) { flash(e.currentTarget, er.message, false); });
  });

  if (file.type === "json" || file.type === "markdown") {
    fetch(file.url, { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (t) {
      var el = overlay.querySelector("#am-text"); if (!el) return;
      try { el.textContent = JSON.stringify(JSON.parse(t), null, 2); } catch (_) { el.textContent = t; }
    }).catch(function () {});
  }
}

async function loadBrowse() {
  var out = document.getElementById("files-out");
  try {
    var r = await j(api + "/projects/" + slug() + "/browse"); var f = r.files || [];
    if (!f.length) { out.innerHTML = "<p class='muted'>No files generated yet.</p>"; return; }
    out.innerHTML = "";
    f.forEach(function (x) {
      var card = document.createElement("div"); card.className = "file-card";
      var icon = typeIcon(x.type);

      var thumb = document.createElement("div"); thumb.className = "file-thumb";
      if (x.type === "image") {
        thumb.className = "file-thumb"; thumb.style.cursor = "zoom-in"; thumb.title = "Click to view";
        var img = document.createElement("img"); img.loading = "lazy"; img.src = x.url; img.alt = x.path;
        thumb.addEventListener("click", function () { openAssetModal(x); });
        thumb.append(img);
      } else if (x.type === "audio") {
        var au = document.createElement("audio"); au.controls = true; au.src = x.url; thumb.append(au);
      } else {
        thumb.className = "file-icon"; thumb.textContent = icon; thumb.style.cursor = "pointer"; thumb.title = "Click to view";
        thumb.addEventListener("click", function () { openAssetModal(x); });
      }

      var meta = document.createElement("div"); meta.className = "file-meta";
      var link = document.createElement("a"); link.href = x.url; link.target = "_blank"; link.textContent = icon + " " + x.path;
      meta.append(link);

      var actions = document.createElement("div"); actions.className = "file-actions";
      var dl = document.createElement("button"); dl.className = "btn"; dl.title = "Download"; dl.textContent = "⬇️";
      dl.addEventListener("click", function () { downloadAsset(x); });
      var cp = document.createElement("button"); cp.className = "btn";
      cp.title = x.type === "image" ? "Copy image to clipboard" : x.type === "audio" ? "Copy URL" : "Copy content";
      cp.textContent = "📋";
      cp.addEventListener("click", function (e) { copyAsset(x, e.currentTarget); });
      var vw = document.createElement("button"); vw.className = "btn"; vw.title = "View larger"; vw.textContent = "🔍";
      vw.addEventListener("click", function () { openAssetModal(x); });
      actions.append(dl, cp, vw);

      card.append(thumb, meta, actions);
      out.append(card);
    });
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
        beatsByAct = {}; // invalidate cached beats so component prompts stay fresh
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

  togglePrompt("show-audio-prompt", "audio-prompt",
    "ElevenLabs TTS\nVoice: George (warm storyteller)\nModel: eleven_turbo_v2_5\nInput: act narration text from script generation.");

  document.getElementById("gen-outline").addEventListener("click", async function (e) { var b = e.currentTarget; loading(b, true); try { var r = await j(api + "/projects/" + s + "/outline", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); document.getElementById("outline-out").textContent = JSON.stringify(r.outline, null, 2); document.getElementById("outline-out").classList.remove("hidden"); document.getElementById("outline-state").textContent = "✅ ready"; } catch (err) { alert(err.message); } finally { loading(b, false); } });
  document.getElementById("gen-script").addEventListener("click", async function (e) { var b = e.currentTarget; var a = acts(); if (!a.length) { alert("Select at least one act."); return; } loading(b, true); try { beatsByAct = {}; await j(api + "/projects/" + s + "/script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: a }) }); await loadScript(); } catch (err) { alert(err.message); } finally { loading(b, false); } });
  document.getElementById("gen-components").addEventListener("click", async function (e) { var b = e.currentTarget; var a = acts(); if (!a.length) { alert("Select at least one act."); return; } loading(b, true); try { await j(api + "/projects/" + s + "/components", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: a }) }); await loadComponents(); } catch (err) { alert(err.message); } finally { loading(b, false); } });
  document.getElementById("gen-audio").addEventListener("click", async function (e) { var b = e.currentTarget; var a = acts(); if (!a.length) { alert("Select at least one act."); return; } loading(b, true); try { await j(api + "/projects/" + s + "/audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acts: a }) }); await loadAudio(); } catch (err) { alert(err.message); } finally { loading(b, false); } });
  document.getElementById("refresh-files").addEventListener("click", function () { loadBrowse(); });

  loadStoryboardImg(); loadOutline(); loadScript(); loadComponents(); loadAudio(); loadBrowse();
});

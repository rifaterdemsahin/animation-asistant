var api = "/api";
var pid = function () { return (window.currentProject && window.currentProject() || {}).project_id; };

function el(id) { return document.getElementById(id); }
function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  if (on) btn.dataset.label = btn.textContent;
  btn.textContent = on ? "Working…" : (btn.dataset.label || btn.textContent);
}

function checked(name) {
  return ["act-1", "act-2", "act-3"].filter(function (k) { return el(name + "-" + k).checked; });
}

async function json(url, opts) {
  var r = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

document.addEventListener("layout:ready", function () {
  var s = pid();
  if (!s) return;
  el("no-project").classList.add("hidden");
  el("manager").classList.remove("hidden");
  var cur = window.currentProject && window.currentProject();
  el("at-title").textContent = cur.title + " (" + s + ")";
  el("at-status").textContent = cur.project_id || cur.slug;

  // Load project notes
  json(api + "/projects/" + s).then(function (p) {
    var notesEl = el("at-notes");
    if (notesEl) notesEl.value = p.notes || "";
  }).catch(function () {});

  el("at-notes-save").addEventListener("click", async function () {
    var btn = el("at-notes-save");
    var notes = el("at-notes").value;
    var status = el("at-notes-status");
    var orig = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;
    status.style.color = "";
    try {
      await json(api + "/projects/" + s, { method: "PUT", body: JSON.stringify({ notes: notes }) });
      status.textContent = "✓ Saved";
      status.style.color = "var(--accent)";
      btn.textContent = orig;
      btn.disabled = false;
      setTimeout(function () { status.textContent = ""; }, 4000);
    } catch (err) {
      status.textContent = "✗ Error: " + err.message;
      status.style.color = "var(--danger)";
      btn.textContent = orig;
      btn.disabled = false;
    }
  });

  el("show-vo-prompt").addEventListener("click", function () {
    var pre = el("vo-prompt");
    if (pre.classList.contains("hidden")) {
      pre.textContent = "ElevenLabs TTS\nVoice: George (warm storyteller)\nModel: eleven_turbo_v2_5\nInput: narration text from each act's script (beats.json → narration field)\nOutput: MP3 per act → saved to Azure: <act-slug>/audio/narration.mp3";
      pre.classList.remove("hidden");
    } else pre.classList.add("hidden");
  });
  el("show-mu-prompt").addEventListener("click", function () {
    var pre = el("mu-prompt");
    if (pre.classList.contains("hidden")) {
      var g = el("music-genre").value, m = el("music-mood").value;
      pre.textContent = "fal.ai — fal-ai/mmaudio-v2\nGenre: " + g + "\nMood: " + m + "\nPrompt per act: '" + g + " " + m + " background music for a <role> act in an explainer video about: " + cur.title + ". 30 seconds, seamless loop.'\nOutput: MP3 per act → saved to Azure: <act-slug>/audio/music.mp3";
      pre.classList.remove("hidden");
    } else pre.classList.add("hidden");
  });
  el("show-sfx-prompt").addEventListener("click", function () {
    var pre = el("sfx-prompt");
    if (pre.classList.contains("hidden")) {
      pre.textContent = "fal.ai — fal-ai/stable-audio\n3 effects per act: whoosh (transition), ding (notification), reveal (dramatic)\nPrompt per effect: '<description>. Short, clean, game-quality sound effect.'\nOutput: MP3 per effect → saved to Azure: <act-slug>/audio/sfx-<name>-01.mp3";
      pre.classList.remove("hidden");
    } else pre.classList.add("hidden");
  });

  el("gen-voiceover").addEventListener("click", async function (e) {
    var acts = checked("vo-act");
    if (!acts.length) { alert("Select at least one act."); return; }
    setLoading(e.currentTarget, true);
    try {
      var res = await json(api + "/projects/" + s + "/audio", { method: "POST", body: JSON.stringify({ acts: acts }) });
      el("vo-out").innerHTML = "<p class='db-ok'>Voiceover generated for " + Object.keys(res.audio).join(", ") + "</p>";
    } catch (err) { el("vo-out").innerHTML = "<p class='error'>" + err.message + "</p>"; }
    finally { setLoading(e.currentTarget, false); }
  });

  el("gen-music").addEventListener("click", async function (e) {
    var acts = checked("mu-act");
    if (!acts.length) { alert("Select at least one act."); return; }
    setLoading(e.currentTarget, true);
    try {
      var res = await json(api + "/projects/" + s + "/audio/music", {
        method: "POST",
        body: JSON.stringify({ acts: acts, genre: el("music-genre").value, mood: el("music-mood").value })
      });
      el("mu-out").innerHTML = "<p class='db-ok'>Music generated for " + Object.keys(res.music).join(", ") + "</p>";
    } catch (err) { el("mu-out").innerHTML = "<p class='error'>" + err.message + "</p>"; }
    finally { setLoading(e.currentTarget, false); }
  });

  el("gen-sfx").addEventListener("click", async function (e) {
    var acts = checked("sfx-act");
    if (!acts.length) { alert("Select at least one act."); return; }
    setLoading(e.currentTarget, true);
    try {
      var res = await json(api + "/projects/" + s + "/audio/sfx", { method: "POST", body: JSON.stringify({ acts: acts }) });
      el("sfx-out").innerHTML = "<p class='db-ok'>SFX generated for " + Object.keys(res.sfx).join(", ") + "</p>";
    } catch (err) { el("sfx-out").innerHTML = "<p class='error'>" + err.message + "</p>"; }
    finally { setLoading(e.currentTarget, false); }
  });
});

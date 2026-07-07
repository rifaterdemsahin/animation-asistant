var api = "/api";

function slug() { return document.getElementById("test-slug").value.trim(); }

async function json(url, opts) {
  var r = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...opts });
  var body = await r.text();
  if (!r.ok) throw new Error(body || r.statusText);
  return body;
}

function resultDiv() { return document.getElementById("results"); }

function addResult(label, ok, detail) {
  var d = document.createElement("div");
  d.style.margin = "4px 0";
  d.style.padding = "8px";
  d.style.borderRadius = "6px";
  d.style.border = "1px solid var(--border)";
  d.style.background = ok ? "#17241a" : "#24171a";
  var icon = ok ? "✅" : "❌";
  d.innerHTML = "<strong>" + icon + " " + label + "</strong>" + (detail ? " <span class='muted'>" + detail + "</span>" : "");
  resultDiv().appendChild(d);
}

async function run(label, fn) {
  var s = slug();
  if (!s) { addResult(label, false, "no slug entered"); return; }
  try {
    var out = await fn(s);
    addResult(label, true, typeof out === "string" ? out.substring(0, 150).replace(/\n/g, " ") : "");
  } catch (e) {
    addResult(label, false, e.message);
  }
}

document.addEventListener("layout:ready", function () {
  var s = slug() || (window.currentProject && window.currentProject() || {}).slug;
  if (s) document.getElementById("test-slug").value = s;

  document.getElementById("show-prompts").addEventListener("click", function () {
    var pre = document.getElementById("prompts-display");
    if (pre.classList.contains("hidden")) {
      pre.textContent = [
        "📝 Outline: System → You design short 3-act outlines. User → Topic: <project>. Produce JSON.",
        "📜 Script: System → Scriptwriter for ONE act, strict JSON. User → Act: act-1..3, 3-6 beats.",
        "🖼️ Components: Image model (gemini-2.5-flash-image). 4 types × 3 acts = 12 images. Prompt: <style>. Illustrate <beat>. Flat vector.",
        "🎙️ Voiceover: ElevenLabs TTS, voice=George, model=eleven_turbo_v2_5. Input = act narration.",
        "🎵 Music: fal.ai mmaudio-v2. Prompt: '<genre> <mood> bg music for <role> act. 30s loop.'",
        "🔉 SFX: fal.ai stable-audio. 3 effects/act: whoosh, ding, reveal.",
        "📋 Storyboard: Gemini assembles scenes. Infographic = 4-frame 2×2 grid (Problem→Solution→Implementation→Lesson)."
      ].join("\n\n");
      pre.classList.remove("hidden");
    } else pre.classList.add("hidden");
  });

  document.getElementById("test-outline").addEventListener("click", function () {
    resultDiv().innerHTML = "";
    run("Outline", function (s) { return json(api + "/projects/" + s + "/outline", { method: "POST" }); });
  });
  document.getElementById("test-script").addEventListener("click", function () {
    resultDiv().innerHTML = "";
    run("Script (3 acts)", function (s) { return json(api + "/projects/" + s + "/script", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); });
  });
  document.getElementById("test-components").addEventListener("click", function () {
    resultDiv().innerHTML = "";
    run("Components (3 acts)", function (s) { return json(api + "/projects/" + s + "/components", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); });
  });
  document.getElementById("test-voiceover").addEventListener("click", function () {
    resultDiv().innerHTML = "";
    run("Voiceover (3 acts)", function (s) { return json(api + "/projects/" + s + "/audio", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); });
  });
  document.getElementById("test-music").addEventListener("click", function () {
    resultDiv().innerHTML = "";
    run("Music (3 acts)", function (s) { return json(api + "/projects/" + s + "/audio/music", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); });
  });
  document.getElementById("test-sfx").addEventListener("click", function () {
    resultDiv().innerHTML = "";
    run("SFX (3 acts)", function (s) { return json(api + "/projects/" + s + "/audio/sfx", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); });
  });
  document.getElementById("test-storyboard").addEventListener("click", function () {
    resultDiv().innerHTML = "";
    run("Storyboard", function (s) { return json(api + "/projects/" + s + "/storyboard", { method: "POST" }); });
  });
  document.getElementById("test-all").addEventListener("click", async function () {
    resultDiv().innerHTML = "";
    var s = slug();
    if (!s) { addResult("All tests", false, "no slug"); return; }
    var steps = [
      ["Outline", function () { return json(api + "/projects/" + s + "/outline", { method: "POST" }); }],
      ["Script", function () { return json(api + "/projects/" + s + "/script", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); }],
      ["Components", function () { return json(api + "/projects/" + s + "/components", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); }],
      ["Voiceover", function () { return json(api + "/projects/" + s + "/audio", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); }],
      ["Music", function () { return json(api + "/projects/" + s + "/audio/music", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); }],
      ["SFX", function () { return json(api + "/projects/" + s + "/audio/sfx", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) }); }],
      ["Storyboard", function () { return json(api + "/projects/" + s + "/storyboard", { method: "POST" }); }],
    ];
    for (var i = 0; i < steps.length; i++) {
      try {
        var out = await steps[i][1]();
        addResult(steps[i][0], true, typeof out === "string" ? out.substring(0, 100) : "");
      } catch (e) {
        addResult(steps[i][0], false, e.message);
        break;
      }
    }
  });
});

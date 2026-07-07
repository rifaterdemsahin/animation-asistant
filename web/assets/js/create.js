var api = "/api";
var slug = "";

function el(id) { return document.getElementById(id); }
function progressPanel() { el("progress").classList.remove("hidden"); return el("steps"); }

async function json(url, opts) {
  var r = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text() || r.statusText);
  return r.json();
}

function getTopic() {
  var q = el("cq").value.trim();
  var a = el("ca").value.trim();
  return a ? q + " → " + a : q;
}

async function createProject() {
  if (!el("cq").value.trim()) return;
  var p = await json(api + "/projects", {
    method: "POST",
    body: JSON.stringify({ title: el("cq").value.trim(), topic: getTopic(), component_type: el("ct").value.trim() || "explainer" })
  });
  slug = p.slug;
  localStorage.setItem("current_project", JSON.stringify({ slug: p.slug, title: p.title }));
  document.dispatchEvent(new CustomEvent("layout:ready"));
  renderHeader();
  return slug;
}

function step(name, icon) {
  var d = document.createElement("div");
  d.className = "row";
  d.style.margin = "4px 0";
  d.innerHTML = "<span>" + icon + " " + name + "</span><span class='muted'>pending</span>";
  progressPanel().appendChild(d);
  return d;
}

function done(d, ok, msg) {
  var s = d.querySelector("span:last-child");
  s.textContent = ok ? "✅ " + msg : "❌ " + msg;
  s.className = ok ? "db-ok" : "error";
}

async function runPipeline(pipelineSteps) {
  progressPanel().innerHTML = "";
  var steps = [];
  for (var i = 0; i < pipelineSteps.length; i++) {
    steps.push(step(pipelineSteps[i].label, pipelineSteps[i].icon));
  }
  for (var i = 0; i < pipelineSteps.length; i++) {
    try {
      var result = await pipelineSteps[i].fn();
      done(steps[i], true, result || "done");
    } catch (err) {
      done(steps[i], false, err.message);
      break;
    }
  }
}

document.addEventListener("layout:ready", function () {
  el("btn-test").addEventListener("click", async function () {
    try {
      var s = await createProject();
      el("progress").innerHTML = "<p class='db-ok'>Project created: <strong>" + s + "</strong></p>";
      el("progress").classList.remove("hidden");
    } catch (err) { alert(err.message); }
  });

  el("btn-act1").addEventListener("click", async function () {
    try {
      var s = await createProject();
      var steps = [
        { label: "Project created", icon: "📁" },
        { label: "Outline", icon: "📝" },
        { label: "Act 1 Script", icon: "📜" },
        { label: "Act 1 Components", icon: "🖼️" },
        { label: "Act 1 Audio", icon: "🎙️" }
      ];
      progressPanel().innerHTML = "";
      var elms = [];
      for (var i = 0; i < steps.length; i++) elms.push(step(steps[i].label, steps[i].icon));
      done(elms[0], true, s);
      await json(api + "/projects/" + s + "/outline", { method: "POST" });
      done(elms[1], true, "generated");
      await json(api + "/projects/" + s + "/script", { method: "POST", body: JSON.stringify({ acts: ["act-1"] }) });
      done(elms[2], true, "generated");
      await json(api + "/projects/" + s + "/components", { method: "POST", body: JSON.stringify({ acts: ["act-1"] }) });
      done(elms[3], true, "generated");
      await json(api + "/projects/" + s + "/audio", { method: "POST", body: JSON.stringify({ acts: ["act-1"] }) });
      done(elms[4], true, "generated");
    } catch (err) { alert(err.message); }
  });

  el("btn-bulk").addEventListener("click", async function () {
    try {
      var s = await createProject();
      var steps = [
        { label: "Project created", icon: "📁" },
        { label: "Outline", icon: "📝" },
        { label: "Script (all 3 acts)", icon: "📜" },
        { label: "Components (all 3 acts)", icon: "🖼️" },
        { label: "Voiceover (all 3 acts)", icon: "🎙️" },
        { label: "Music (all 3 acts)", icon: "🎵" },
        { label: "Sound Effects", icon: "🔉" },
        { label: "Storyboard", icon: "📋" }
      ];
      progressPanel().innerHTML = "";
      var elms = [];
      for (var i = 0; i < steps.length; i++) elms.push(step(steps[i].label, steps[i].icon));
      done(elms[0], true, s);
      await json(api + "/projects/" + s + "/outline", { method: "POST" });
      done(elms[1], true, "generated");
      await json(api + "/projects/" + s + "/script", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) });
      done(elms[2], true, "generated");
      await json(api + "/projects/" + s + "/components", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) });
      done(elms[3], true, "generated");
      await json(api + "/projects/" + s + "/audio", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) });
      done(elms[4], true, "generated");
      await json(api + "/projects/" + s + "/audio/music", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) });
      done(elms[5], true, "generated");
      await json(api + "/projects/" + s + "/audio/sfx", { method: "POST", body: JSON.stringify({ acts: ["act-1", "act-2", "act-3"] }) });
      done(elms[6], true, "generated");
      await json(api + "/projects/" + s + "/storyboard", { method: "POST" });
      done(elms[7], true, "generated");
    } catch (err) { alert(err.message); }
  });
});

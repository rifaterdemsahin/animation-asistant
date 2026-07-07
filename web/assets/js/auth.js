// Auth: gate protected pages, handle login form.

const isLoginPage = location.pathname.endsWith("/login.html") || location.pathname === "/pages/login.html";

async function requireAuth() {
  try {
    const r = await fetch("/api/me", { credentials: "same-origin" });
    if (!r.ok) throw new Error("unauthorized");
    return true;
  } catch {
    location.href = "/pages/login.html";
    return false;
  }
}

function handleLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("login-error");
    const password = document.getElementById("password").value;
    err.classList.add("hidden");
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });
    if (r.ok) {
      location.href = "/";
    } else {
      err.textContent = "Invalid password.";
      err.classList.remove("hidden");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (isLoginPage) {
    handleLoginForm();
  } else {
    const ok = await requireAuth();
    if (!ok) return;
  }
});

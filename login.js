const AUTH_KEY = "mum_debt_auth_v1";

// hard-coded credentials (simple front-end login)
const VALID_USERNAME = "nkechilouis";
const VALID_PASSWORD = "loveyoumom";

const el = (id) => document.getElementById(id);

function isAuthed() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!data && data.user === VALID_USERNAME;
  } catch {
    return false;
  }
}

function setMsg(text) {
  el("loginMsg").textContent = text;
}

function login() {
  const u = el("username").value.trim();
  const p = el("password").value;

  if (!u || !p) {
    setMsg("Please enter username and password.");
    return;
  }

  if (u === VALID_USERNAME && p === VALID_PASSWORD) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ user: u, ts: Date.now() }));
    window.location.href = "index.html";
    return;
  }

  setMsg("Wrong username or password.");
}

if (isAuthed()) {
  window.location.href = "index.html";
}

el("loginBtn").addEventListener("click", login);

el("password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

el("username").addEventListener("keydown", (e) => {
  if (e.key === "Enter") el("password").focus();
});

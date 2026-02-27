const STORAGE_KEY = "mum_debt_tracker_v1";
const AUTH_KEY = "mum_debt_auth_v1";
const VALID_USER = "nkechilouis";

function requireAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) {
      window.location.href = "login.html";
      return false;
    }
    const a = JSON.parse(raw);
    if (!a || a.user !== VALID_USER) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  } catch {
    window.location.href = "login.html";
    return false;
  }
}

if (!requireAuth()) {
  // stop the rest of the file from running on unauthenticated access
  throw new Error("Not authenticated");
}

const UI_KEY = "mum_debt_ui_v1"; // stores small UI preferences (like show/hide checked)

const el = (id) => document.getElementById(id);

const nameEl = el("name");
const owingEl = el("owing");
const paidEl = el("paid");
const remainingEl = el("remaining");
const statusEl = el("status");
const remarkEl = el("remark");

const addBtn = el("addBtn");
const clearFormBtn = el("clearFormBtn");
const wipeAllBtn = el("wipeAllBtn");

const rowsEl = el("rows");
const searchEl = el("search");
const totalsEl = el("totals");
const editingHintEl = el("editingHint");

const logoutBtn = el("logoutBtn");
const loggedInAsEl = el("loggedInAs");

let data = load();
let editingId = null;

let ui = loadUI();

function loadUI() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    return raw ? { showChecked: true, ...JSON.parse(raw) } : { showChecked: true };
  } catch {
    return { showChecked: true };
  }
}

function saveUI() {
  localStorage.setItem(UI_KEY, JSON.stringify(ui));
}

function toMoney(n) {
  const x = Number(n);
  if (!isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function num(n) {
  const x = Number(n);
  return isFinite(x) ? x : 0;
}

function calcRemaining(owing, paid) {
  return Math.max(0, num(owing) - num(paid));
}

function calcStatus(owing, paid) {
  return calcRemaining(owing, paid) <= 0 && num(owing) > 0
    ? "Payment Completed"
    : "Payment Not Completed";
}

function updateCalculatorPreview() {
  const owing = owingEl.value;
  const paid = paidEl.value;
  remainingEl.value = toMoney(calcRemaining(owing, paid));
  statusEl.value = calcStatus(owing, paid);
}

owingEl.addEventListener("input", updateCalculatorPreview);
paidEl.addEventListener("input", updateCalculatorPreview);

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setLoggedInText() {
  try {
    const a = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
    loggedInAsEl.textContent = a.user ? `Logged in as: ${a.user}` : "";
  } catch {
    loggedInAsEl.textContent = "";
  }
}

function toggleChecked(id, isChecked) {
  const idx = data.findIndex((x) => x.id === id);
  if (idx === -1) return;
  data[idx].checked = !!isChecked;
  data[idx].updatedAt = Date.now();
  save();
  render();
}

function renderSeparatorRow(checkedCount) {
  const tr = document.createElement("tr");
  tr.className = "checked-separator";
  tr.innerHTML = `
    <td colspan="8">
      <button type="button" class="checked-toggle" id="toggleCheckedBtn">
        ${ui.showChecked ? "▾" : "▸"} ${checkedCount} checked record${checkedCount === 1 ? "" : "s"}
      </button>
    </td>
  `;
  rowsEl.appendChild(tr);

  const btn = tr.querySelector("#toggleCheckedBtn");
  btn.addEventListener("click", () => {
    ui.showChecked = !ui.showChecked;
    saveUI();
    render();
  });
}

function renderRow(r) {
  const owing = num(r.owing);
  const paid = num(r.paid);
  const remaining = calcRemaining(owing, paid);
  const status = calcStatus(owing, paid);

  const tr = document.createElement("tr");
  if (r.checked) tr.classList.add("checked-row");

  tr.innerHTML = `
    <td class="checkcol">
      <input class="rowcheck" type="checkbox" ${r.checked ? "checked" : ""} data-check="${r.id}" aria-label="Mark as checked" />
    </td>
    <td><strong>${escapeHtml(r.name || "")}</strong></td>
    <td class="right">${toMoney(owing)}</td>
    <td class="right">${toMoney(paid)}</td>
    <td class="right">${toMoney(remaining)}</td>
    <td>
      <span class="pill ${status === "Payment Completed" ? "ok" : "no"}">
        ${status}
      </span>
    </td>
    <td>${escapeHtml(r.remark || "")}</td>
    <td>
      <div class="actions">
        <button class="btn-ghost" type="button" data-edit="${r.id}">Edit</button>
        <button class="btn-danger" type="button" data-del="${r.id}">Delete</button>
      </div>
    </td>
  `;
  rowsEl.appendChild(tr);
}

function render() {
  const q = searchEl.value.trim().toLowerCase();

  const filtered = !q
    ? data
    : data.filter((r) => (r.name || "").toLowerCase().includes(q));

  // Keep-style behavior: unchecked items on top, checked items move down
  const unchecked = filtered.filter((r) => !r.checked);
  const checked = filtered.filter((r) => !!r.checked);

  rowsEl.innerHTML = "";

  // Totals should count ALL records in filtered list (both checked & unchecked)
  let totalOwing = 0, totalPaid = 0, totalRemaining = 0;

  for (const r of filtered) {
    const owing = num(r.owing);
    const paid = num(r.paid);
    const remaining = calcRemaining(owing, paid);
    totalOwing += owing;
    totalPaid += paid;
    totalRemaining += remaining;
  }

  // Render unchecked first
  for (const r of unchecked) renderRow(r);

  // Then checked section
  if (checked.length > 0) {
    renderSeparatorRow(checked.length);

    if (ui.showChecked) {
      for (const r of checked) renderRow(r);
    }
  }

  totalsEl.textContent =
    `Totals — Owing: ${toMoney(totalOwing)} | Paid: ${toMoney(totalPaid)} | Remaining: ${toMoney(totalRemaining)}`;

  // wire actions (edit/delete)
  rowsEl.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => startEdit(btn.getAttribute("data-edit")));
  });
  rowsEl.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => remove(btn.getAttribute("data-del")));
  });

  // wire checkboxes
  rowsEl.querySelectorAll("[data-check]").forEach((cb) => {
    cb.addEventListener("change", () => toggleChecked(cb.getAttribute("data-check"), cb.checked));
  });
}

function clearForm() {
  editingId = null;
  nameEl.value = "";
  owingEl.value = "";
  paidEl.value = "";
  remarkEl.value = "";
  updateCalculatorPreview();

  editingHintEl.textContent = "";
  addBtn.textContent = "Add / Save";
  nameEl.focus();
}

function upsert() {
  const name = nameEl.value.trim();
  const owing = num(owingEl.value);
  const paid = num(paidEl.value);
  const remark = remarkEl.value.trim();

  if (!name) {
    alert("Please enter the customer name.");
    nameEl.focus();
    return;
  }
  if (owing < 0 || paid < 0) {
    alert("Amounts cannot be negative.");
    return;
  }

  const existing = editingId ? data.find((x) => x.id === editingId) : null;

  const record = {
    id: editingId || crypto.randomUUID(),
    name,
    owing,
    paid,
    remark,
    checked: existing ? !!existing.checked : false, // keep checked state when editing
    updatedAt: Date.now(),
  };

  if (editingId) {
    const idx = data.findIndex((x) => x.id === editingId);
    if (idx !== -1) data[idx] = record;
  } else {
    data.unshift(record);
  }

  save();
  render();
  clearForm();
}

function startEdit(id) {
  const r = data.find((x) => x.id === id);
  if (!r) return;

  editingId = id;
  nameEl.value = r.name || "";
  owingEl.value = num(r.owing);
  paidEl.value = num(r.paid);
  remarkEl.value = r.remark || "";
  updateCalculatorPreview();

  editingHintEl.textContent = "Editing: make changes then click “Add / Save”.";
  addBtn.textContent = "Save Changes";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function remove(id) {
  const r = data.find((x) => x.id === id);
  if (!r) return;

  if (!confirm(`Delete record for "${r.name}"?`)) return;
  data = data.filter((x) => x.id !== id);

  save();
  render();

  if (editingId === id) clearForm();
}

function wipeAll() {
  if (!confirm("This will permanently delete ALL records. Continue?")) return;
  data = [];
  save();
  render();
  clearForm();
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.href = "login.html";
}

addBtn.addEventListener("click", upsert);
clearFormBtn.addEventListener("click", clearForm);
wipeAllBtn.addEventListener("click", wipeAll);
searchEl.addEventListener("input", render);
logoutBtn.addEventListener("click", logout);

// initial
setLoggedInText();
updateCalculatorPreview();
render();

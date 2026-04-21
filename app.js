const STORAGE_KEY = "mum_debt_tracker_v1";
const AUTH_KEY = "mum_debt_auth_v1";
const VALID_USER = "nkechilouis";

function requireAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) { window.location.href = "login.html"; return false; }
    const a = JSON.parse(raw);
    if (!a || a.user !== VALID_USER) { window.location.href = "login.html"; return false; }
    return true;
  } catch { window.location.href = "login.html"; return false; }
}

if (!requireAuth()) throw new Error("Not authenticated");

const UI_KEY = "mum_debt_ui_v1";

const el = (id) => document.getElementById(id);

const nameEl        = el("name");
const owingEl       = el("owing");
const paidEl        = el("paid");
const paidHintEl    = el("paidHint");
const remainingEl   = el("remaining");
const statusEl      = el("status");
const remarkEl      = el("remark");

const addBtn        = el("addBtn");
const clearFormBtn  = el("clearFormBtn");
const wipeAllBtn    = el("wipeAllBtn");
const historyBtn    = el("historyBtn");

const rowsEl        = el("rows");
const searchEl      = el("search");
const totalsEl      = el("totals");
const editingHintEl = el("editingHint");

const logoutBtn     = el("logoutBtn");
const loggedInAsEl  = el("loggedInAs");

// History modal elements
const historyModal       = el("historyModal");
const historyModalClose  = el("historyModalClose");
const historyModalTitle  = el("historyModalTitle");
const historyModalBody   = el("historyModalBody");

let data      = load();
let editingId = null;
let ui        = loadUI();

// ─── UI prefs ────────────────────────────────────────────────────────────────
function loadUI() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    return raw ? { showChecked: true, ...JSON.parse(raw) } : { showChecked: true };
  } catch { return { showChecked: true }; }
}
function saveUI() { localStorage.setItem(UI_KEY, JSON.stringify(ui)); }

// ─── Maths helpers ───────────────────────────────────────────────────────────
function toMoney(n) {
  const x = Number(n);
  return isFinite(x) ? x.toFixed(2) : "0.00";
}

function num(n) {
  const x = Number(n);
  return isFinite(x) ? x : 0;
}

function calcRemaining(owing, paid) { return Math.max(0, num(owing) - num(paid)); }
// Amount Paid is always deducted from remaining balance, not reset against owing

function calcStatus(owing, paid) {
  return calcRemaining(owing, paid) <= 0 && num(owing) > 0
    ? "Payment Completed"
    : "Payment Not Completed";
}

/**
 * Evaluate the paid field.
 * Supports:
 *   plain number      → 150000
 *   +N  (add)         → currentPaid + N
 *   -N  (subtract)    → currentPaid - N
 * Returns { newPaid, delta, op } or null on invalid input.
 */
function evaluatePaidInput(rawValue, currentPaid) {
  const val = rawValue.trim();
  if (val === "" || val === "+" || val === "-") return null;

  const addMatch = val.match(/^\+\s*([0-9]*\.?[0-9]+)$/);
  const subMatch = val.match(/^-\s*([0-9]*\.?[0-9]+)$/);

  if (addMatch) {
    const delta = parseFloat(addMatch[1]);
    return { newPaid: Math.max(0, num(currentPaid) + delta), delta: +delta, op: "add" };
  }
  if (subMatch) {
    const delta = parseFloat(subMatch[1]);
    return { newPaid: Math.max(0, num(currentPaid) - delta), delta: -delta, op: "sub" };
  }

  const plain = parseFloat(val);
  if (!isNaN(plain) && plain >= 0) {
    return { newPaid: Math.max(0, num(currentPaid) + plain), delta: +plain, op: "add" };
  }
  return null; // invalid
}

// ─── Live preview of paid field ───────────────────────────────────────────────
function updateCalculatorPreview() {
  const owingVal  = owingEl.value;
  const rawPaid   = paidEl.value.trim();

  // Resolve current paid (for + / - operations)
  const currentPaid = editingId
    ? num((data.find(x => x.id === editingId) || {}).paid)
    : 0;

  const result = evaluatePaidInput(rawPaid, currentPaid);

  if (rawPaid === "" || rawPaid === "+" || rawPaid === "-") {
    // nothing typed yet
    remainingEl.value = toMoney(calcRemaining(owingVal, currentPaid));
    statusEl.value    = calcStatus(owingVal, currentPaid);
    paidHintEl.textContent = "";
    return;
  }

  if (!result) {
    paidHintEl.textContent = "⚠ Invalid value";
    paidHintEl.style.color = "#c0392b";
    return;
  }

  paidHintEl.style.color = "#0b6b2a";
  if (result.op === "add") {
    paidHintEl.textContent = `→ ${toMoney(num(currentPaid))} + ${toMoney(result.delta)} = ${toMoney(result.newPaid)}`;
  } else if (result.op === "sub") {
    paidHintEl.textContent = `→ ${toMoney(num(currentPaid))} − ${toMoney(Math.abs(result.delta))} = ${toMoney(result.newPaid)}`;
  } else {
    paidHintEl.textContent = `→ Set to ${toMoney(result.newPaid)}`;
  }

  remainingEl.value = toMoney(calcRemaining(owingVal, result.newPaid));
  statusEl.value    = calcStatus(owingVal, result.newPaid);
}

owingEl.addEventListener("input", updateCalculatorPreview);
paidEl.addEventListener("input",  updateCalculatorPreview);

// ─── Storage ──────────────────────────────────────────────────────────────────
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

// ─── Escape ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// ─── Auth display ─────────────────────────────────────────────────────────────
function setLoggedInText() {
  try {
    const a = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
    loggedInAsEl.textContent = a.user ? `Logged in as: ${a.user}` : "";
  } catch { loggedInAsEl.textContent = ""; }
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function toggleChecked(id, isChecked) {
  const idx = data.findIndex(x => x.id === id);
  if (idx === -1) return;
  data[idx].checked   = !!isChecked;
  data[idx].updatedAt = Date.now();
  save();
  render();
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function renderSeparatorRow(checkedCount) {
  const tr = document.createElement("tr");
  tr.className = "checked-separator";
  tr.innerHTML = `
    <td colspan="8">
      <button type="button" class="checked-toggle" id="toggleCheckedBtn">
        ${ui.showChecked ? "▾" : "▸"} ${checkedCount} checked record${checkedCount === 1 ? "" : "s"}
      </button>
    </td>`;
  rowsEl.appendChild(tr);
  tr.querySelector("#toggleCheckedBtn").addEventListener("click", () => {
    ui.showChecked = !ui.showChecked;
    saveUI();
    render();
  });
}

function renderRow(r) {
  const owing     = num(r.owing);
  const paid      = num(r.paid);
  const remaining = calcRemaining(owing, paid);
  const status    = calcStatus(owing, paid);
  const histCount = (r.history || []).length;

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
        <button class="btn-history" type="button" data-hist="${r.id}" title="View payment history">
          🕓 ${histCount}
        </button>
        <button class="btn-ghost" type="button" data-edit="${r.id}">Edit</button>
        <button class="btn-danger" type="button" data-del="${r.id}">Delete</button>
      </div>
    </td>`;
  rowsEl.appendChild(tr);
}

function render() {
  const q        = searchEl.value.trim().toLowerCase();
  const filtered = !q ? data : data.filter(r => (r.name || "").toLowerCase().includes(q));

  const unchecked = filtered.filter(r => !r.checked);
  const checked   = filtered.filter(r => !!r.checked);

  rowsEl.innerHTML = "";

  let totalOwing = 0, totalPaid = 0, totalRemaining = 0;
  for (const r of filtered) {
    totalOwing     += num(r.owing);
    totalPaid      += num(r.paid);
    totalRemaining += calcRemaining(r.owing, r.paid);
  }

  for (const r of unchecked) renderRow(r);

  if (checked.length > 0) {
    renderSeparatorRow(checked.length);
    if (ui.showChecked) for (const r of checked) renderRow(r);
  }

  totalsEl.textContent =
    `Totals — Owing: ${toMoney(totalOwing)} | Paid: ${toMoney(totalPaid)} | Remaining: ${toMoney(totalRemaining)}`;

  rowsEl.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => startEdit(btn.getAttribute("data-edit"))));
  rowsEl.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => remove(btn.getAttribute("data-del"))));
  rowsEl.querySelectorAll("[data-check]").forEach(cb =>
    cb.addEventListener("change", () => toggleChecked(cb.getAttribute("data-check"), cb.checked)));
  rowsEl.querySelectorAll("[data-hist]").forEach(btn =>
    btn.addEventListener("click", () => openHistory(btn.getAttribute("data-hist"))));
}

// ─── Form ─────────────────────────────────────────────────────────────────────
function clearForm() {
  editingId             = null;
  nameEl.value          = "";
  owingEl.value         = "";
  paidEl.value          = "";
  remarkEl.value        = "";
  paidHintEl.textContent = "";
  updateCalculatorPreview();
  editingHintEl.textContent = "";
  addBtn.textContent    = "Add / Save";
  nameEl.focus();
}

function upsert() {
  const name   = nameEl.value.trim();
  const owing  = num(owingEl.value);
  const remark = remarkEl.value.trim();
  const rawPaid = paidEl.value.trim();

  if (!name) { alert("Please enter the customer name."); nameEl.focus(); return; }
  if (owing < 0) { alert("Amount owing cannot be negative."); return; }

  const existing    = editingId ? data.find(x => x.id === editingId) : null;
  const currentPaid = existing ? num(existing.paid) : 0;

  // Resolve paid arithmetic
  let newPaid = currentPaid;
  let historyEntry = null;

  if (rawPaid === "" || rawPaid === "+" || rawPaid === "-") {
    // no change to paid
    newPaid = currentPaid;
  } else {
    const result = evaluatePaidInput(rawPaid, currentPaid);
    if (!result) { alert("The Amount Paid field has an invalid value. Use a number, +amount, or -amount."); paidEl.focus(); return; }
    newPaid = result.newPaid;

    // Build history entry (only if paid actually changed)
    if (result.newPaid !== currentPaid) {
      let desc = "";
      if (result.op === "add")      desc = `+${toMoney(result.delta)} added (${toMoney(currentPaid)} → ${toMoney(result.newPaid)})`;
      else if (result.op === "sub") desc = `-${toMoney(Math.abs(result.delta))} deducted (${toMoney(currentPaid)} → ${toMoney(result.newPaid)})`;
      else                           desc = `Set to ${toMoney(result.newPaid)} (was ${toMoney(currentPaid)})`;

      historyEntry = {
        ts:      Date.now(),
        desc,
        remark:  remark || null,
        prevPaid: currentPaid,
        newPaid:  result.newPaid,
        delta:    result.delta,
      };
    }
  }

  const now = Date.now();
  const prevHistory = existing ? (existing.history || []) : [];
  const newHistory  = historyEntry ? [...prevHistory, historyEntry] : prevHistory;

  const record = {
    id:        editingId || crypto.randomUUID(),
    name,
    owing,
    paid:      newPaid,
    remark,
    checked:   calcRemaining(owing, newPaid) <= 0 && owing > 0 ? true : (existing ? !!existing.checked : false),
    updatedAt: now,
    createdAt: existing ? (existing.createdAt || now) : now,
    history:   newHistory,
  };

  if (editingId) {
    const idx = data.findIndex(x => x.id === editingId);
    if (idx !== -1) data[idx] = record;
  } else {
    data.unshift(record);
  }

  save();
  render();
  clearForm();
}

function startEdit(id) {
  const r = data.find(x => x.id === id);
  if (!r) return;

  editingId      = id;
  nameEl.value   = r.name  || "";
  owingEl.value  = num(r.owing);
  paidEl.value   = ""; // leave blank — user types a delta or new value
  remarkEl.value = r.remark || "";

  paidHintEl.textContent = `Current paid: ${toMoney(num(r.paid))}. Leave blank to keep, or type +amount / -amount / new total.`;
  paidHintEl.style.color = "#5b6270";

  updateCalculatorPreview();
  editingHintEl.textContent = `Editing "${r.name}" — make changes then click "Add / Save".`;
  addBtn.textContent        = "Save Changes";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function remove(id) {
  const r = data.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Delete record for "${r.name}"?`)) return;
  data = data.filter(x => x.id !== id);
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

// ─── History modal ─────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function openHistory(id) {
  const r = data.find(x => x.id === id);
  if (!r) return;

  historyModalTitle.textContent = `Payment History — ${r.name}`;

  const history = r.history || [];
  if (history.length === 0) {
    historyModalBody.innerHTML = `
      <p class="hist-empty">No payment history yet. When you add or change the Amount Paid for this record, entries will appear here.</p>`;
  } else {
    const rows = [...history].reverse().map((h, i) => {
      const isAdd = h.delta > 0;
      const isSub = h.delta < 0;
      const badge = isAdd ? `<span class="hist-badge add">+${toMoney(h.delta)}</span>`
                  : isSub ? `<span class="hist-badge sub">-${toMoney(Math.abs(h.delta))}</span>`
                  :         `<span class="hist-badge set">Set</span>`;
      return `
        <div class="hist-row">
          <div class="hist-meta">
            <span class="hist-date">${formatDate(h.ts)}</span>
            ${badge}
          </div>
          <div class="hist-desc">${escapeHtml(h.desc)}</div>
          ${h.remark ? `<div class="hist-remark">"${escapeHtml(h.remark)}"</div>` : ""}
        </div>`;
    }).join("");

    historyModalBody.innerHTML = `
      <div class="hist-summary">
        <span>Total entries: <strong>${history.length}</strong></span>
        <span>Current paid: <strong>${toMoney(num(r.paid))}</strong></span>
        <span>Remaining: <strong>${toMoney(calcRemaining(r.owing, r.paid))}</strong></span>
      </div>
      <div class="hist-list">${rows}</div>`;
  }

  historyModal.classList.add("open");
}

function closeHistory() {
  historyModal.classList.remove("open");
}

historyModalClose.addEventListener("click", closeHistory);
historyModal.addEventListener("click", e => { if (e.target === historyModal) closeHistory(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeHistory(); });

historyBtn.addEventListener("click", () => {
  // Open global history view
  historyModalTitle.textContent = "All Payment History";

  const allEntries = [];
  for (const r of data) {
    for (const h of (r.history || [])) {
      allEntries.push({ ...h, customerName: r.name });
    }
  }

  if (allEntries.length === 0) {
    historyModalBody.innerHTML = `<p class="hist-empty">No payment history recorded yet.</p>`;
  } else {
    allEntries.sort((a, b) => b.ts - a.ts);
    const rows = allEntries.map(h => {
      const isAdd = h.delta > 0;
      const isSub = h.delta < 0;
      const badge = isAdd ? `<span class="hist-badge add">+${toMoney(h.delta)}</span>`
                  : isSub ? `<span class="hist-badge sub">-${toMoney(Math.abs(h.delta))}</span>`
                  :         `<span class="hist-badge set">Set</span>`;
      return `
        <div class="hist-row">
          <div class="hist-meta">
            <span class="hist-customer">${escapeHtml(h.customerName)}</span>
            <span class="hist-date">${formatDate(h.ts)}</span>
            ${badge}
          </div>
          <div class="hist-desc">${escapeHtml(h.desc)}</div>
          ${h.remark ? `<div class="hist-remark">"${escapeHtml(h.remark)}"</div>` : ""}
        </div>`;
    }).join("");

    historyModalBody.innerHTML = `<div class="hist-list">${rows}</div>`;
  }

  historyModal.classList.add("open");
});

// ─── Logout ───────────────────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.href = "login.html";
}

addBtn.addEventListener("click",      upsert);
clearFormBtn.addEventListener("click", clearForm);
wipeAllBtn.addEventListener("click",   wipeAll);
searchEl.addEventListener("input",     render);
logoutBtn.addEventListener("click",    logout);

// init
setLoggedInText();
updateCalculatorPreview();
render();

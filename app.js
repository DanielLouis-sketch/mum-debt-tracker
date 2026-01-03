const STORAGE_KEY = "mum_debt_tracker_v1";

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

let data = load();
let editingId = null;

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

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const filtered = !q
    ? data
    : data.filter((r) => (r.name || "").toLowerCase().includes(q));

  rowsEl.innerHTML = "";

  let totalOwing = 0, totalPaid = 0, totalRemaining = 0;

  for (const r of filtered) {
    const owing = num(r.owing);
    const paid = num(r.paid);
    const remaining = calcRemaining(owing, paid);
    const status = calcStatus(owing, paid);

    totalOwing += owing;
    totalPaid += paid;
    totalRemaining += remaining;

    const tr = document.createElement("tr");
    tr.innerHTML = `
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

  totalsEl.textContent =
    `Totals — Owing: ${toMoney(totalOwing)} | Paid: ${toMoney(totalPaid)} | Remaining: ${toMoney(totalRemaining)}`;

  rowsEl.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => startEdit(btn.getAttribute("data-edit")));
  });
  rowsEl.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => remove(btn.getAttribute("data-del")));
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

  const record = {
    id: editingId || crypto.randomUUID(),
    name,
    owing,
    paid,
    remark,
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

addBtn.addEventListener("click", upsert);
clearFormBtn.addEventListener("click", clearForm);
wipeAllBtn.addEventListener("click", wipeAll);
searchEl.addEventListener("input", render);

// initial
updateCalculatorPreview();
render();

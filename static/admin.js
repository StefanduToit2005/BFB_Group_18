/* Admin request queue (Node 2) */
if (!UI.init("admin", UI.STAFF)) throw new Error("Not allowed");

const $ = id => document.getElementById(id);
let allMessages = [];
let sortKey = "createdAt", sortDir = "desc";
let currentMsg = null;

const viewModal = new bootstrap.Modal($("viewModal"));
const logModal = new bootstrap.Modal($("logModal"));

const URGENCY_RANK = { urgent: 0, soon: 1, routine: 2 };
const STATUS_RANK = { new: 0, forwarded: 1, completed: 2 };

// ---------- load ----------
async function load() {
  $("queueBody").innerHTML = `<tr><td colspan="6" class="ml-state-cell">${UI.loading("Loading requests...")}</td></tr>`;
  try {
    const [messages, stats] = await Promise.all([MediLinkAPI.getMessages("all"), MediLinkAPI.getStats()]);
    allMessages = messages;
    renderKpis(stats);
    renderTable();
  } catch (err) {
    $("queueBody").innerHTML = `<tr><td colspan="6" class="ml-state-cell">${UI.error(err.message)}</td></tr>`;
  }
}

function renderKpis(s) {
  $("kNew").textContent = s.new;
  $("kUrgent").textContent = s.urgentOpen;
  $("kFwd").textContent = s.forwarded;
  $("kAvg").textContent = s.avgResponseHours ? `${s.avgResponseHours.toFixed(1)} h` : "–";
}

// ---------- table ----------
function currentFilter() { return document.querySelector('input[name="statusFilter"]:checked').value; }

function renderTable() {
  const status = currentFilter();
  const q = $("search").value.trim().toLowerCase();
  let rows = allMessages.filter(m =>
    (status === "all" || m.status === status) &&
    (!q || m.patientName.toLowerCase().includes(q) || m.patientNo.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q)));

  rows.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === "urgency") { va = URGENCY_RANK[va]; vb = URGENCY_RANK[vb]; }
    if (sortKey === "status") { va = STATUS_RANK[va]; vb = STATUS_RANK[vb]; }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (!rows.length) {
    const msg = q ? "No requests match your search." : status === "new" ? "All caught up. No new requests." : "No requests here.";
    $("queueBody").innerHTML = `<tr><td colspan="6" class="ml-state-cell">${UI.empty(msg, q ? "bi-search" : "bi-check2-all")}</td></tr>`;
    return;
  }

  $("queueBody").innerHTML = rows.map(m => `
    <tr tabindex="0" data-id="${m.id}" aria-label="Open request from ${UI.escapeHtml(m.patientName)}">
      <td data-label="Received"><span title="${UI.fmtDateTime(m.createdAt)}">${UI.timeAgo(m.createdAt)}</span></td>
      <td data-label="Patient"><div class="fw-semibold">${UI.escapeHtml(m.patientName)}</div><div class="small text-muted">${m.patientNo}</div></td>
      <td data-label="Subject">${UI.escapeHtml(m.subject)}<div class="small text-muted d-none d-sm-block">${UI.escapeHtml(m.category)}</div></td>
      <td data-label="Channel">${UI.escapeHtml(m.channel)}</td>
      <td data-label="Urgency">${UI.urgencyBadge(m.urgency)}</td>
      <td data-label="Status">${UI.statusBadge(m.status)}</td>
    </tr>`).join("");
}

document.querySelectorAll('input[name="statusFilter"]').forEach(r => r.addEventListener("change", renderTable));
$("search").addEventListener("input", renderTable);

document.querySelectorAll(".sort-btn").forEach(btn => btn.addEventListener("click", () => {
  const key = btn.dataset.sort;
  sortDir = (sortKey === key && sortDir === "asc") ? "desc" : "asc";
  sortKey = key;
  document.querySelectorAll(".sort-btn").forEach(b => b.removeAttribute("aria-sort"));
  btn.setAttribute("aria-sort", sortDir === "asc" ? "ascending" : "descending");
  renderTable();
}));

// Open a row with click or Enter key
$("queueBody").addEventListener("click", e => {
  const tr = e.target.closest("tr[data-id]"); if (tr) openRequest(Number(tr.dataset.id));
});
$("queueBody").addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") {
    const tr = e.target.closest("tr[data-id]"); if (tr) { e.preventDefault(); openRequest(Number(tr.dataset.id)); }
  }
});

// ---------- view modal ----------
function openRequest(id) {
  currentMsg = allMessages.find(m => m.id === id);
  if (!currentMsg) return;
  const m = currentMsg;
  $("viewTitle").textContent = m.subject;
  $("viewMeta").innerHTML = `${UI.escapeHtml(m.category)} &middot; ${UI.escapeHtml(m.channel)} &middot; ${UI.fmtDateTime(m.createdAt)} &middot; ${UI.statusBadge(m.status)}`;
  $("viewBody").textContent = m.body;
  $("viewUrgency").value = m.urgency;
  $("viewNote").value = m.adminNote || "";
  $("viewPatientName").textContent = m.patientName;
  $("viewPatientNo").textContent = m.patientNo;
  $("viewFileBadge").innerHTML = UI.fileBadge(m.digitised);
  $("viewOpenFile").href = `patient-file.html?id=${encodeURIComponent(m.patientNo)}`;
  // Paper-only patients get a shortcut straight to the scan upload
  $("viewScanFile").href = `patient-file.html?id=${encodeURIComponent(m.patientNo)}#digitise`;
  $("viewScanFile").classList.toggle("d-none", m.digitised);

  const done = m.status === "completed";
  $("forwardBtn").classList.toggle("d-none", done || m.status === "forwarded");
  $("completeBtn").classList.toggle("d-none", done);
  viewModal.show();
}

async function saveChanges(extra = {}, msg = "Saved.") {
  try {
    await MediLinkAPI.updateMessage(currentMsg.id, {
      urgency: $("viewUrgency").value,
      adminNote: $("viewNote").value.trim(),
      ...extra
    });
    viewModal.hide();
    UI.toast(msg);
    load();
  } catch (err) {
    UI.toast(err.message, "error");
  }
}
$("saveBtn").addEventListener("click", () => saveChanges());
$("forwardBtn").addEventListener("click", () => saveChanges({ status: "forwarded" }, "Forwarded to the neurologist."));
$("completeBtn").addEventListener("click", () => saveChanges({ status: "completed", response: "Handled by admin." }, "Marked as completed."));

// ---------- log phone / walk-in ----------
let searchTimer = null;
$("patientSearch").addEventListener("input", e => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { $("patientResults").innerHTML = ""; return; }
  searchTimer = setTimeout(async () => {
    $("patientResults").innerHTML = `<div class="list-group-item small text-muted">Searching...</div>`;
    const results = await MediLinkAPI.getPatients(q);
    $("patientResults").innerHTML = results.length
      ? results.slice(0, 6).map(p => `
          <button type="button" class="list-group-item list-group-item-action" role="option" data-pn="${p.patientNo}" data-name="${UI.escapeHtml(p.firstName + " " + p.surname)}">
            <div class="d-flex justify-content-between"><strong>${UI.escapeHtml(p.firstName)} ${UI.escapeHtml(p.surname)}</strong><span class="small text-muted">${p.patientNo}</span></div>
            <div class="small text-muted">${UI.escapeHtml(UI.docLabel(p))} &middot; ${UI.escapeHtml(p.phone)}</div>
          </button>`).join("")
      : `<div class="list-group-item small">No patient found. If they are new, ask them to register first or <a href="patient-register.html">register them now</a>.</div>`;
  }, 250);
});

$("patientResults").addEventListener("click", e => {
  const btn = e.target.closest("[data-pn]"); if (!btn) return;
  $("logPatientNo").value = btn.dataset.pn;
  $("pickedPatient").innerHTML = `<i class="bi bi-link-45deg me-1" aria-hidden="true"></i>Linked to <strong>${btn.dataset.name}</strong> (${btn.dataset.pn})`;
  $("pickedPatient").classList.remove("d-none");
  $("patientError").classList.add("d-none");
  $("patientResults").innerHTML = "";
  $("patientSearch").value = "";
});

$("logForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  form.classList.add("was-validated");
  const hasPatient = !!$("logPatientNo").value;
  $("patientError").classList.toggle("d-none", hasPatient);
  if (!form.checkValidity() || !hasPatient) { (hasPatient ? form.querySelector(":invalid") : $("patientSearch"))?.focus(); return; }

  try {
    await MediLinkAPI.createMessage({
      patientNo: $("logPatientNo").value,
      channel: $("logChannel").value,
      urgency: $("logUrgency").value,
      category: $("logCategory").value,
      subject: $("logSubject").value.trim(),
      body: $("logBody").value.trim()
    });
    logModal.hide();
    form.reset(); form.classList.remove("was-validated");
    $("logPatientNo").value = ""; $("pickedPatient").classList.add("d-none");
    UI.toast("Request added to the queue.");
    document.getElementById("fNew").checked = true;
    load();
  } catch (err) {
    UI.toast(err.message, "error");
  }
});

load();

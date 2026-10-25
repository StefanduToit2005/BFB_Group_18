/* Neurologist view (Node 3) - prioritised request list */
if (!UI.init("neuro", ["neurologist"])) throw new Error("Not allowed");

const $ = id => document.getElementById(id);
const RANK = { urgent: 0, soon: 1, routine: 2 };
const doneModal = new bootstrap.Modal($("doneModal"));
let activeId = null;
let cache = [];

async function load() {
  $("requestList").innerHTML = UI.loading("Loading requests...");
  try {
    const all = await MediLinkAPI.getMessages("all");
    cache = all;
    render();
  } catch (err) {
    $("requestList").innerHTML = UI.error(err.message);
  }
}

function render() {
  const open = cache.filter(m => m.status === "forwarded")
    .sort((a, b) => RANK[a.urgency] - RANK[b.urgency] || a.createdAt.localeCompare(b.createdAt));

  $("cUrgent").textContent = open.filter(m => m.urgency === "urgent").length;
  $("cSoon").textContent = open.filter(m => m.urgency === "soon").length;
  $("cRoutine").textContent = open.filter(m => m.urgency === "routine").length;

  const today = new Date().toDateString();
  const doneToday = $("showDone").checked
    ? cache.filter(m => m.status === "completed" && m.completedAt && new Date(m.completedAt).toDateString() === today)
    : [];

  if (!open.length && !doneToday.length) {
    $("requestList").innerHTML = `<div class="ml-card">${UI.empty("No requests waiting. Nice work.", "bi-cup-hot")}</div>`;
    return;
  }

  const card = (m, done) => `
    <article class="ml-card ml-card-tight request-card urgency-${m.urgency} mb-3 ${done ? "opacity-75" : ""}">
      <div class="d-flex justify-content-between flex-wrap gap-2">
        <div>
          <div class="d-flex gap-2 align-items-center mb-1">${UI.urgencyBadge(m.urgency)}
            <span class="small text-muted">${UI.escapeHtml(m.category)} &middot; sent ${UI.timeAgo(m.createdAt)}</span></div>
          <h2 class="h5 mb-1">${UI.escapeHtml(m.subject)}</h2>
          <div class="small"><strong>${UI.escapeHtml(m.patientName)}</strong> <span class="text-muted">${m.patientNo}</span> ${UI.fileBadge(m.digitised)}</div>
        </div>
        <div class="d-flex gap-2 align-items-start">
          <a class="btn btn-outline-primary btn-sm" href="patient-file.html?id=${encodeURIComponent(m.patientNo)}">
            <i class="bi bi-folder2-open me-1" aria-hidden="true"></i>Open file</a>
          ${done ? UI.statusBadge("completed")
                 : `<button class="btn btn-primary btn-sm" data-done="${m.id}"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Complete</button>`}
        </div>
      </div>
      <p class="small mb-1 mt-2">${UI.escapeHtml(m.body)}</p>
      ${m.adminNote ? `<div class="small bg-light rounded p-2"><i class="bi bi-sticky me-1" aria-hidden="true"></i><strong>Admin note.</strong> ${UI.escapeHtml(m.adminNote)}</div>` : ""}
      ${done && m.response ? `<div class="small text-success mt-1"><i class="bi bi-reply me-1" aria-hidden="true"></i>${UI.escapeHtml(m.response)}</div>` : ""}
    </article>`;

  $("requestList").innerHTML =
    (open.length ? open.map(m => card(m, false)).join("") : `<div class="ml-card mb-3">${UI.empty("No open requests.", "bi-check2-all")}</div>`) +
    (doneToday.length ? `<h2 class="h6 small-caps mt-4 mb-2">Completed today</h2>` + doneToday.map(m => card(m, true)).join("") : "");
}

$("showDone").addEventListener("change", render);

$("requestList").addEventListener("click", e => {
  const btn = e.target.closest("[data-done]"); if (!btn) return;
  activeId = Number(btn.dataset.done);
  const m = cache.find(x => x.id === activeId);
  $("doneFor").textContent = `${m.patientName} (${m.patientNo}) · ${m.subject}`;
  $("doneResponse").value = "";
  $("doneForm").classList.remove("was-validated");
  doneModal.show();
});

$("doneForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  form.classList.add("was-validated");
  if (!form.checkValidity()) return;
  try {
    await MediLinkAPI.updateMessage(activeId, { status: "completed", response: $("doneResponse").value.trim() });
    doneModal.hide();
    UI.toast("Request completed. The patient can see your reply.");
    load();
  } catch (err) {
    UI.toast(err.message, "error");
  }
});

load();

/* Patient file - the single digital record that replaces the paper binder */
if (!UI.init("records", UI.STAFF)) throw new Error("Not allowed");

const $ = id => document.getElementById(id);
const patientNo = UI.query("id");

async function load() {
  $("fileState").innerHTML = UI.loading("Opening patient file...");
  $("fileContent").classList.add("d-none");

  if (!patientNo) {
    $("fileState").innerHTML = UI.error("No patient was selected. Go back to Patient records and pick one.");
    return;
  }
  try {
    const p = await MediLinkAPI.getPatient(patientNo);
    render(p);
    $("fileState").innerHTML = "";
    $("fileContent").classList.remove("d-none");
  } catch (err) {
    $("fileState").innerHTML = UI.error(err.status === 404
      ? `No patient with number ${patientNo} was found.` : err.message);
  }
}

function render(p) {
  const name = `${p.firstName} ${p.surname}`;
  document.title = `MediLink | ${name}`;
  $("crumb").textContent = name;
  $("pTitle").textContent = name;
  $("pSub").textContent = `Patient number ${p.patientNo}`;
  $("pBadge").innerHTML = UI.fileBadge(p.digitised);
  $("dId").textContent = UI.docLabel(p);
  $("dDob").textContent = p.dob ? UI.fmtDate(p.dob) : "Not captured";
  $("dEmail").textContent = p.email;
  $("dPhone").textContent = p.phone;
  $("dAddress").textContent = p.address;
  $("dSince").textContent = UI.fmtDate(p.createdAt);
  $("digiText").textContent = p.digitised
    ? "This patient's paper file has been scanned. Add any new documents here."
    : "This patient's history is still in the paper archive. Scan it in when the file is next pulled, so it never has to be searched for again.";

  // Requests
  $("reqList").innerHTML = p.messages.length
    ? `<div class="list-group list-group-flush">${p.messages.map(m => `
        <div class="list-group-item px-0">
          <div class="d-flex justify-content-between flex-wrap gap-2">
            <div><div class="fw-semibold">${UI.escapeHtml(m.subject)}</div>
              <div class="small text-muted">${UI.escapeHtml(m.channel)} &middot; ${UI.fmtDateTime(m.createdAt)}</div></div>
            <div class="d-flex gap-1 align-items-start">${UI.urgencyBadge(m.urgency)} ${UI.statusBadge(m.status)}</div>
          </div>
          <p class="small mb-1 mt-1">${UI.escapeHtml(m.body)}</p>
          ${m.adminNote ? `<div class="small text-muted"><i class="bi bi-sticky me-1" aria-hidden="true"></i>${UI.escapeHtml(m.adminNote)}</div>` : ""}
          ${m.response ? `<div class="small text-success"><i class="bi bi-reply me-1" aria-hidden="true"></i>${UI.escapeHtml(m.response)}</div>` : ""}
        </div>`).join("")}</div>`
    : UI.empty("No requests yet.", "bi-chat-left");

  // History
  const hist = [...p.history].sort((a, b) => b.date.localeCompare(a.date));
  $("histList").innerHTML = hist.length
    ? `<ul class="ml-timeline">${hist.map(h => `
        <li><div class="small text-muted">${UI.fmtDate(h.date)} &middot; ${UI.escapeHtml(h.type)}</div>
            <div>${UI.escapeHtml(h.note)}</div></li>`).join("")}</ul>`
    : UI.empty("No history captured yet. New patient.", "bi-journal");

  // Documents
  const fmtSize = b => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
  const docIcon = d => d.mime && d.mime.startsWith("image/") ? "bi-file-earmark-image text-primary" : "bi-file-earmark-pdf text-danger";
  const docs = [...p.documents].sort((a, b) => b.date.localeCompare(a.date));
  $("docList").innerHTML = docs.length
    ? `<div class="table-responsive"><table class="table table-sm align-middle mb-0 doc-table">
        <thead><tr><th scope="col">File</th><th scope="col">Type</th><th scope="col">Added</th><th scope="col" class="text-end">Actions</th></tr></thead>
        <tbody>${docs.map(d => `
          <tr>
            <td><div class="d-flex gap-1"><i class="bi ${docIcon(d)}" aria-hidden="true"></i><span class="text-break">${UI.escapeHtml(d.name)}</span></div>
              ${d.hasFile ? `<div class="small text-muted">${fmtSize(d.size)}${d.uploadedBy ? " &middot; by " + UI.escapeHtml(d.uploadedBy) : ""}</div>` : ""}
              ${d.note ? `<div class="small text-muted">${UI.escapeHtml(d.note)}</div>` : ""}</td>
            <td>${UI.escapeHtml(d.type)}</td>
            <td class="text-nowrap">${UI.fmtDate(d.date)}</td>
            <td class="text-end text-nowrap">${d.hasFile ? `
              <button type="button" class="btn btn-outline-primary btn-sm" data-view="${d.id}" aria-label="Open ${UI.escapeHtml(d.name)}"><i class="bi bi-eye" aria-hidden="true"></i> Open</button>
              <button type="button" class="btn btn-outline-secondary btn-sm" data-download="${d.id}" aria-label="Download ${UI.escapeHtml(d.name)}"><i class="bi bi-download" aria-hidden="true"></i></button>
              <button type="button" class="btn btn-outline-danger btn-sm" data-delete="${d.id}" aria-label="Delete ${UI.escapeHtml(d.name)}"><i class="bi bi-trash" aria-hidden="true"></i></button>`
              : `<span class="small text-muted">Sample entry</span>`}</td>
          </tr>`).join("")}
        </tbody></table></div>`
    : UI.empty(p.digitised ? "No documents uploaded." : "Nothing scanned yet. Paper file only.", "bi-archive");
}

// ---------- open / download / delete ----------
$("docList").addEventListener("click", async e => {
  const btn = e.target.closest("[data-view],[data-download],[data-delete]");
  if (!btn) return;
  const id = btn.dataset.view || btn.dataset.download || btn.dataset.delete;
  try {
    if (btn.dataset.delete) {
      if (!confirmDelete(btn)) return;
      await MediLinkAPI.deleteDocument(patientNo, id);
      UI.toast("Document removed.");
      return load();
    }
    const { blob, name } = await MediLinkAPI.getDocumentFile(patientNo, id);
    const url = URL.createObjectURL(blob);
    if (btn.dataset.view) {
      window.open(url, "_blank", "noopener");
    } else {
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    UI.toast(err.message, "error");
  }
});

// Two-click delete instead of a browser pop-up
function confirmDelete(btn) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = "1";
  btn.innerHTML = "Sure?";
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>'; } }, 3000);
  return false;
}

// ---------- upload (CamScanner PDFs etc.) ----------
let queue = [];
const MAX = MediLinkAPI.MAX_FILE_MB;
$("maxMb").textContent = MAX;

function addFiles(fileList) {
  const errors = [];
  [...fileList].forEach(file => {
    const okType = MediLinkAPI.ALLOWED_TYPES.includes(file.type) || /\.(pdf|jpe?g|png)$/i.test(file.name);
    if (!okType) errors.push(`${file.name} is not a PDF, JPG or PNG.`);
    else if (file.size > MAX * 1048576) errors.push(`${file.name} is bigger than ${MAX} MB.`);
    else if (!queue.some(q => q.name === file.name && q.size === file.size)) queue.push(file);
  });
  $("fileError").textContent = errors.join(" ");
  $("fileError").classList.toggle("d-none", !errors.length);
  renderQueue();
}

function renderQueue(status = {}) {
  const fmt = b => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
  $("fileQueue").innerHTML = queue.map((f, i) => `
    <li class="list-group-item px-0 d-flex align-items-center gap-2">
      <i class="bi ${f.type.startsWith("image/") ? "bi-file-earmark-image text-primary" : "bi-file-earmark-pdf text-danger"}" aria-hidden="true"></i>
      <span class="flex-fill small text-truncate">${UI.escapeHtml(f.name)} <span class="text-muted">&middot; ${fmt(f.size)}</span></span>
      ${status[i] === "busy" ? '<span class="spinner-border spinner-border-sm text-primary" role="status" aria-label="Uploading"></span>'
        : status[i] === "done" ? '<i class="bi bi-check-circle-fill text-success" aria-label="Uploaded"></i>'
        : `<button type="button" class="btn btn-sm btn-link text-danger p-0" data-remove="${i}" aria-label="Remove ${UI.escapeHtml(f.name)}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`}
    </li>`).join("");
  $("uploadOptions").classList.toggle("d-none", !queue.length);
  $("uploadLabel").textContent = queue.length > 1 ? `Upload ${queue.length} files` : "Upload";
}

$("fileQueue").addEventListener("click", e => {
  const btn = e.target.closest("[data-remove]");
  if (btn) { queue.splice(Number(btn.dataset.remove), 1); renderQueue(); }
});
$("docFile").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });

// Drag and drop
const zone = $("dropZone");
["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("drag-over"); }));
["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("drag-over"); }));
zone.addEventListener("drop", e => addFiles(e.dataTransfer.files));
// Stop the browser opening a file that's dropped just outside the box
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => e.preventDefault());

$("docType").addEventListener("change", e => { $("completesFile").checked = e.target.value === "Scanned paper record"; });

$("docForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!queue.length) return;
  const btn = $("uploadBtn");
  btn.disabled = true; btn.querySelector(".spinner-border").classList.remove("d-none");
  const status = {};
  let done = 0;
  try {
    for (let i = 0; i < queue.length; i++) {
      status[i] = "busy"; renderQueue(status);
      await MediLinkAPI.addDocument(patientNo, {
        type: $("docType").value,
        note: $("docNote").value.trim(),
        completesFile: $("completesFile").checked
      }, queue[i]);
      status[i] = "done"; done++; renderQueue(status);
    }
    UI.toast(`${done} file${done === 1 ? "" : "s"} added to the digital file.`);
    queue = []; $("docNote").value = "";
    $("fileError").classList.add("d-none");
    renderQueue();
    load();
  } catch (err) {
    UI.toast(err.message, "error");
    queue = queue.slice(done); renderQueue();
    if (done) load();
  } finally {
    btn.disabled = false; btn.querySelector(".spinner-border").classList.add("d-none");
  }
});

load().then(() => {
  // Coming from the admin queue's "Scan in paper file" button
  if (location.hash === "#digitise") $("digitise").scrollIntoView({ behavior: "smooth" });
});

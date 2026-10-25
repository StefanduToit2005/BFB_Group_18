/* Patient portal (Node 1)
   - Patients see only their own record (the API also enforces this).
   - Admin and neurologist pick a patient first, then can view and
     send requests for them, for example at reception. */
const user = UI.init("patient", ["patient", "admin", "neurologist"]);
if (!user) throw new Error("Not allowed");

const $ = id => document.getElementById(id);
const isStaff = UI.STAFF.includes(user.role);
let currentPatient = null;

function busy(btn, on) {
  btn.disabled = on;
  btn.querySelector(".spinner-border")?.classList.toggle("d-none", !on);
}

// ---------- staff: pick a patient ----------
function showPicker() {
  currentPatient = null;
  $("staffPicker").classList.remove("d-none");
  $("staffBanner").classList.add("d-none");
  $("portalView").classList.add("d-none");
  $("pickSearch").value = "";
  $("pickResults").innerHTML = "";
  $("pickSearch").focus();
}

let timer = null;
$("pickSearch").addEventListener("input", e => {
  clearTimeout(timer);
  const q = e.target.value.trim();
  if (q.length < 2) { $("pickResults").innerHTML = ""; return; }
  timer = setTimeout(async () => {
    $("pickResults").innerHTML = `<div class="list-group-item small text-muted">Searching...</div>`;
    try {
      const list = await MediLinkAPI.getPatients(q);
      $("pickResults").innerHTML = list.length
        ? list.slice(0, 8).map(p => `
            <button type="button" class="list-group-item list-group-item-action" data-pn="${p.patientNo}">
              <div class="d-flex justify-content-between"><strong>${UI.escapeHtml(p.firstName)} ${UI.escapeHtml(p.surname)}</strong><span class="small text-muted">${p.patientNo}</span></div>
              <div class="small text-muted">${UI.escapeHtml(UI.docLabel(p))} &middot; ${UI.escapeHtml(p.phone)}</div>
            </button>`).join("")
        : `<div class="list-group-item small">No patient found. <a href="patient-register.html">Register a new patient</a>.</div>`;
    } catch (err) {
      $("pickResults").innerHTML = `<div class="list-group-item small text-danger">${UI.escapeHtml(err.message)}</div>`;
    }
  }, 250);
});
$("pickResults").addEventListener("click", e => {
  const btn = e.target.closest("[data-pn]");
  if (btn) showPortal(btn.dataset.pn);
});
$("changePatient").addEventListener("click", showPicker);

// ---------- portal ----------
async function showPortal(patientNo) {
  $("staffPicker").classList.add("d-none");
  $("portalView").classList.remove("d-none");
  $("myRequests").innerHTML = UI.loading("Loading requests...");
  try {
    currentPatient = await MediLinkAPI.getPatient(patientNo);
    const p = currentPatient;
    $("pPatientNo").textContent = p.patientNo;
    $("pName").textContent = `${p.firstName} ${p.surname}`;
    $("pEmail").textContent = p.email;
    $("pPhone").textContent = p.phone;
    $("pFileBadge").innerHTML = UI.fileBadge(p.digitised);
    if (isStaff) {
      $("staffBanner").classList.remove("d-none");
      $("bannerName").textContent = `${p.firstName} ${p.surname} (${p.patientNo})`;
      $("bannerFile").href = `patient-file.html?id=${encodeURIComponent(p.patientNo)}`;
    } else {
      $("headerText").textContent = `Welcome back, ${p.firstName}. Send requests to the practice and see replies from the doctor.`;
    }
    renderRequests(p.messages);
  } catch (err) {
    $("myRequests").innerHTML = UI.error(err.message);
  }
}

function renderRequests(messages) {
  if (!messages.length) {
    $("myRequests").innerHTML = `<div class="ml-card">${UI.empty(isStaff ? "This patient hasn't sent any requests yet." : "You haven't sent any requests yet.", "bi-chat-left-text")}</div>`;
    return;
  }
  const steps = ["new", "forwarded", "completed"];
  $("myRequests").innerHTML = messages.map(m => {
    const at = steps.indexOf(m.status);
    const tracker = steps.map((s, i) => `
      <div class="flex-fill text-center">
        <div class="progress mb-1" style="height:6px" role="presentation">
          <div class="progress-bar ${i <= at ? "" : "bg-transparent"}" style="width:100%"></div>
        </div>
        <span class="small ${i <= at ? "fw-semibold" : "text-muted"}">${["Received", "With doctor", "Done"][i]}</span>
      </div>`).join("");
    return `
      <article class="ml-card ml-card-tight mb-3">
        <div class="d-flex justify-content-between flex-wrap gap-2">
          <div>
            <h3 class="h6 mb-1">${UI.escapeHtml(m.subject)}</h3>
            <div class="small text-muted">${UI.escapeHtml(m.category)} &middot; ${UI.escapeHtml(m.channel)} &middot; ${UI.fmtDateTime(m.createdAt)}</div>
          </div>
          <div>${UI.statusBadge(m.status)}</div>
        </div>
        <div class="d-flex gap-2 mt-3" aria-label="Request progress, ${UI.STATUS_LABEL[m.status]}">${tracker}</div>
        ${m.response ? `<div class="alert alert-success small mt-3 mb-0"><strong>Reply from the practice.</strong> ${UI.escapeHtml(m.response)}</div>` : ""}
      </article>`;
  }).join("");
}

// ---------- send request ----------
$("body").addEventListener("input", e => { $("charCount").textContent = e.target.value.length; });

$("requestForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  form.classList.add("was-validated");
  if (!form.checkValidity()) { form.querySelector(":invalid")?.focus(); return; }

  busy($("sendBtn"), true);
  try {
    await MediLinkAPI.createMessage({
      patientNo: currentPatient.patientNo,
      channel: isStaff ? $("channel").value : "Patient portal",
      category: $("category").value,
      subject: $("subject").value.trim(),
      body: $("body").value.trim(),
      urgency: form.querySelector('input[name="urgency"]:checked').value
    });
    form.reset(); form.classList.remove("was-validated"); $("charCount").textContent = "0";
    UI.toast(isStaff ? "Request added to the queue." : "Request sent. You can track it on the right.");
    await showPortal(currentPatient.patientNo);
  } catch (err) {
    UI.toast(err.message || "Could not send the request.", "error");
  } finally {
    busy($("sendBtn"), false);
  }
});

// ---------- start ----------
if (isStaff) {
  $("pageTitle").textContent = "Patient portal";
  $("headerText").textContent = "Staff view. Pick a patient to see their requests or send one for them.";
  $("channelGroup").classList.remove("d-none");
  $("sendHelp").textContent = "Logs the request on this patient's file and adds it to the admin queue.";
  $("myReqHeading").textContent = "Their requests";
  const pn = UI.query("patientNo");
  pn ? showPortal(pn) : showPicker();
} else {
  showPortal(user.patientNo);
}

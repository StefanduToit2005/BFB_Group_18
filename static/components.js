/* ==========================================================
   MediLink - reusable components and helpers
   Plain HTML has no "include", so the navbar and footer are
   built here once and dropped into every page. When we move
   to Flask these become base.html with Jinja blocks.
   ========================================================== */

const UI = (() => {
  // Which pages each role can see (the order is the navbar order)
  const ROLE_NAV = {
    patient: [
      { href: "patient-portal.html", label: "My portal", icon: "bi-person", key: "patient" }
    ],
    admin: [
      { href: "admin.html", label: "Request queue", icon: "bi-inbox", key: "admin" },
      { href: "patients.html", label: "Patient records", icon: "bi-people", key: "records" },
      { href: "patient-portal.html", label: "Patient portal", icon: "bi-person", key: "patient" }
    ],
    neurologist: [
      { href: "neurologist.html", label: "My requests", icon: "bi-clipboard2-pulse", key: "neuro" },
      { href: "admin.html", label: "Request queue", icon: "bi-inbox", key: "admin" },
      { href: "patients.html", label: "Patient records", icon: "bi-people", key: "records" },
      { href: "patient-portal.html", label: "Patient portal", icon: "bi-person", key: "patient" },
      { href: "dashboard.html", label: "Dashboard", icon: "bi-graph-up", key: "dashboard" }
    ]
  };
  const ROLE_HOME = { patient: "patient-portal.html", admin: "admin.html", neurologist: "neurologist.html" };
  const ROLE_LABEL = { patient: "Patient", admin: "Administrator", neurologist: "Neurologist" };
  const STAFF = ["admin", "neurologist"];

  function renderNavbar(activeKey, user) {
    const el = document.getElementById("site-nav");
    if (!el) return;
    const items = user ? ROLE_NAV[user.role] : [];
    const links = items.map(l => `
      <li class="nav-item">
        <a class="nav-link ${l.key === activeKey ? "active" : ""}" href="${l.href}" ${l.key === activeKey ? 'aria-current="page"' : ""}>
          <i class="bi ${l.icon} me-1" aria-hidden="true"></i>${l.label}
        </a>
      </li>`).join("");
    const userMenu = user ? `
      <li class="nav-item dropdown ms-lg-2">
        <button class="nav-link dropdown-toggle btn btn-link" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="bi bi-person-circle me-1" aria-hidden="true"></i>${escapeHtml(user.name)}
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><span class="dropdown-item-text small text-muted">${ROLE_LABEL[user.role]}${user.patientNo ? " &middot; " + user.patientNo : ""}</span></li>
          <li><hr class="dropdown-divider"></li>
          <li><button class="dropdown-item" type="button" id="logoutBtn"><i class="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Log out</button></li>
        </ul>
      </li>` : `
      <li class="nav-item"><a class="nav-link ${activeKey === "home" ? "active" : ""}" href="index.html"><i class="bi bi-box-arrow-in-right me-1" aria-hidden="true"></i>Log in</a></li>`;
    el.innerHTML = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <nav class="navbar navbar-expand-lg navbar-dark ml-navbar" aria-label="Main navigation">
        <div class="container">
          <a class="navbar-brand d-flex align-items-center gap-2" href="${user ? ROLE_HOME[user.role] : "index.html"}">
            <i class="bi bi-heart-pulse-fill" aria-hidden="true"></i> MediLink
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav"
                  aria-controls="mainNav" aria-expanded="false" aria-label="Open menu">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav ms-auto gap-lg-1 align-items-lg-center">${links}${userMenu}</ul>
          </div>
        </div>
      </nav>`;
    document.getElementById("logoutBtn")?.addEventListener("click", logout);
  }

  async function logout() {
    await MediLinkAPI.logout();
    location.href = "index.html?loggedout=1";
  }

  function renderFooter(user) {
    const el = document.getElementById("site-footer");
    if (!el) return;
    const canReset = user && STAFF.includes(user.role);
    el.innerHTML = `
      <footer class="ml-footer">
        <div class="container d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
          <span>MediLink prototype &middot; BFB 321 Supply Chain Technologies &middot; Sample data only</span>
          ${canReset ? `<button type="button" class="btn btn-sm btn-link p-0 text-decoration-none" id="resetDemoBtn">
            <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i> Reset demo data
          </button>` : ""}
        </div>
      </footer>
      <div class="toast-container position-fixed bottom-0 end-0 p-3" id="toastArea" aria-live="polite" aria-atomic="true"></div>`;
    document.getElementById("resetDemoBtn")?.addEventListener("click", async () => {
      await MediLinkAPI.resetDemo();
      toast("Demo data has been reset.");
      setTimeout(() => location.reload(), 600);
    });
  }

  function toast(message, type = "success") {
    const area = document.getElementById("toastArea");
    if (!area) return;
    const icon = type === "success" ? "bi-check-circle-fill text-success" : "bi-exclamation-triangle-fill text-danger";
    const wrap = document.createElement("div");
    wrap.className = "toast align-items-center border-0 shadow";
    wrap.setAttribute("role", type === "success" ? "status" : "alert");
    wrap.innerHTML = `
      <div class="d-flex">
        <div class="toast-body"><i class="bi ${icon} me-2" aria-hidden="true"></i>${escapeHtml(message)}</div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>`;
    area.appendChild(wrap);
    const t = new bootstrap.Toast(wrap, { delay: 3500 });
    t.show();
    wrap.addEventListener("hidden.bs.toast", () => wrap.remove());
  }

  // ---------- state blocks (loading / empty / error) ----------
  const loading = (text = "Loading...") =>
    `<div class="ml-state" role="status"><div class="spinner-border text-primary mb-2" aria-hidden="true"></div><div>${text}</div></div>`;
  const empty = (text, icon = "bi-inbox") =>
    `<div class="ml-state"><i class="bi ${icon}" aria-hidden="true"></i>${text}</div>`;
  const error = (text = "Something went wrong. Please try again.") =>
    `<div class="ml-state text-danger" role="alert"><i class="bi bi-exclamation-octagon" aria-hidden="true"></i>${escapeHtml(text)}</div>`;

  // ---------- badges ----------
  const STATUS_LABEL = { new: "New", forwarded: "With neurologist", completed: "Completed" };
  const URGENCY_LABEL = { urgent: "Urgent", soon: "Soon", routine: "Routine" };
  const statusBadge = s => `<span class="badge badge-status-${s}">${STATUS_LABEL[s] || s}</span>`;
  const urgencyBadge = u => `<span class="badge badge-urgency-${u}">${URGENCY_LABEL[u] || u}</span>`;
  const fileBadge = digitised => digitised
    ? `<span class="badge badge-digitised"><i class="bi bi-cloud-check me-1" aria-hidden="true"></i>Digitised</span>`
    : `<span class="badge badge-paper"><i class="bi bi-archive me-1" aria-hidden="true"></i>Paper file</span>`;

  // ---------- formatting ----------
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const fmtDate = iso => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  const fmtDateTime = iso => new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  function timeAgo(iso) {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} h ago`;
    const days = Math.round(hrs / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  const rand = n => "R" + Math.round(n).toLocaleString("en-ZA");
  const maskId = id => id ? id.slice(0, 6) + " **** ***" : "";

  // ---------- validation (South African formats) ----------
  // SA ID: 13 digits, valid date of birth, Luhn check digit
  function isValidSAId(id) {
    if (!/^\d{13}$/.test(id)) return false;
    const mm = +id.slice(2, 4), dd = +id.slice(4, 6);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      let d = +id[12 - i];
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    return sum % 10 === 0;
  }
  // SA number (0 + 9 digits) or international (+ and 8 to 15 digits)
  const isValidPhone = p => { const s = p.replace(/[\s()-]/g, ""); return /^0\d{9}$/.test(s) || /^\+\d{8,15}$/.test(s); };
  // Works out date of birth (YYYY-MM-DD) from an SA ID number
  function dobFromSAId(id) {
    if (!/^\d{6}/.test(id)) return "";
    const yy = +id.slice(0, 2), thisYY = new Date().getFullYear() % 100;
    const year = (yy > thisYY ? 1900 : 2000) + yy;
    return `${year}-${id.slice(2, 4)}-${id.slice(4, 6)}`;
  }
  // "SA ID 680412 **** ***" or "Passport (Zimbabwe) FN12****"
  function docLabel(p) {
    if (p.idType === "Passport") return `Passport (${p.country || "unknown"}) ${p.idNumber.slice(0, 4)}****`;
    return `SA ID ${maskId(p.idNumber)}`;
  }
  const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

  // Shows a custom message on a field and lets Bootstrap style it
  function setFieldError(input, message) {
    input.setCustomValidity(message || "");
    const fb = input.parentElement.querySelector(".invalid-feedback") ||
               input.closest(".mb-3, .col-md-6, .col-12, .col-md-4, .col-md-8")?.querySelector(".invalid-feedback");
    if (fb && message) fb.textContent = message;
  }

  function query(name) { return new URLSearchParams(location.search).get(name); }

  /**
   * Sets up the page and checks access.
   * roles = list of roles allowed on this page, or null for a public page.
   * Returns the logged-in user, or null if the user is being sent away.
   */
  function init(activeKey, roles = null) {
    const user = MediLinkAPI.currentUser();
    if (roles && (!user || !roles.includes(user.role))) {
      document.documentElement.style.visibility = "hidden";
      const reason = user ? "denied" : "login";
      location.replace(`index.html?${reason}=1`);
      return null;
    }
    renderNavbar(activeKey, user);
    renderFooter(user);
    return user || {};
  }

  return {
    init, logout, ROLE_HOME, ROLE_LABEL, STAFF, toast, loading, empty, error, statusBadge, urgencyBadge, fileBadge,
    escapeHtml, fmtDate, fmtDateTime, timeAgo, rand, maskId,
    isValidSAId, isValidPhone, dobFromSAId, docLabel, isValidEmail, setFieldError, query,
    STATUS_LABEL, URGENCY_LABEL
  };
})();

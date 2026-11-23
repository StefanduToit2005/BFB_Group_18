/* ==========================================================
   MediLink - data layer wired to Flask API
   Handles session cookies, error unwrapping, pagination,
   and snake_case <-> camelCase mapping so all 8 pages work.
   ========================================================== */

const MediLinkAPI = (() => {
  const SESSION_KEY = "medilink-session";
  const MAX_FILE_MB = 20;
  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

  // ---------- session helpers ----------
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
  }
  function setSession(s) {
    try { s ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) : sessionStorage.removeItem(SESSION_KEY); } catch {}
  }

  function apiError(message, status = 400, field = null) {
    const e = new Error(message);
    e.status = status;
    e.field = field;
    return e;
  }

  // ---------- core fetch wrapper ----------
  async function apiFetch(url, options = {}) {
    const isFormData = options.body instanceof FormData;
    const res = await fetch(url, {
      credentials: "same-origin", // sends Flask session cookie
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {})
      }
    });

    if (res.status === 401 && !url.includes("/api/auth/login")) {
      setSession(null);
      location.replace("index.html?login=1");
      throw apiError("Session expired. Please log in again.", 401);
    }

    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : null;

    if (!res.ok) {
      const errObj = data && data.error;
      const msg = (errObj && errObj.message) || (typeof errObj === "string" ? errObj : null) || `Request failed (${res.status})`;
      throw apiError(msg, res.status, errObj && errObj.field);
    }
    return data;
  }

  // ---------- snake_case -> camelCase mappers ----------
  const mapUser = u => ({
    role: u.role,
    username: u.username,
    name: u.name || u.full_name || u.username,
    patientNo: u.patient_no || u.patientNo || undefined
  });

  const mapDoc = d => ({
    id: d.id,
    name: d.file_name || d.name,
    type: d.doc_type || d.type,
    note: d.note || "",
    size: d.size_bytes ?? d.size ?? 0,
    mime: d.mime_type || d.mime || "",
    hasFile: true,
    uploadedBy: d.uploaded_by_name || d.uploaded_by || "",
    date: d.created_at || d.date
  });

  const mapHistory = h => ({
    date: h.event_date || h.date,
    type: h.event_type || h.type,
    note: h.note || ""
  });

  const mapRequest = r => ({
    id: r.id,
    patientNo: r.patient_no || r.patientNo,
    patientName: r.patient_name || r.patientName || "Unknown patient",
    digitised: Boolean(r.digitised),
    channel: r.channel,
    category: r.category,
    subject: r.subject,
    body: r.body,
    urgency: r.urgency,
    status: r.status,
    adminNote: r.admin_note ?? r.adminNote ?? "",
    response: r.response || "",
    createdAt: r.created_at || r.createdAt,
    completedAt: r.completed_at || r.completedAt || null
  });

  const mapPatient = p => ({
    patientNo: p.patient_no || p.patientNo,
    idType: p.id_type || p.idType || "SA ID",
    idNumber: p.id_number || p.idNumber,
    country: p.country || "South Africa",
    dob: p.date_of_birth || p.dob || "",
    firstName: p.first_name || p.firstName,
    surname: p.surname,
    email: p.email,
    phone: p.phone,
    address: p.address,
    digitised: Boolean(p.digitised),
    createdAt: p.created_at || p.createdAt,
    history: (p.medical_history || p.history || []).map(mapHistory),
    documents: (p.documents || []).map(mapDoc),
    messages: (p.requests || p.messages || []).map(mapRequest)
  });

  return {
    MAX_FILE_MB,
    ALLOWED_TYPES,

    // ---------- auth ----------
    async login(role, username, password) {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ role, username: String(username || "").trim(), password })
      });
      const session = mapUser(data.user || data);
      setSession(session);
      return session;
    },

    async logout() {
      try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch {}
      setSession(null);
      return true;
    },

    currentUser() {
      return getSession();
    },

    async fetchCurrentUser() {
      const data = await apiFetch("/api/auth/me");
      const session = mapUser(data.user || data);
      setSession(session);
      return session;
    },

    // ---------- patients ----------
    async getPatients(search = "") {
      const params = new URLSearchParams({ size: "100" });
      if (search.trim()) params.set("search", search.trim());
      const data = await apiFetch(`/api/patients?${params}`);
      return (data.items || data).map(mapPatient);
    },

    async getPatient(patientNo) {
      const [pData, rData] = await Promise.all([
        apiFetch(`/api/patients/${encodeURIComponent(patientNo)}`),
        apiFetch(`/api/patients/${encodeURIComponent(patientNo)}/requests?size=100`).catch(() => ({ items: [] }))
      ]);
      const patient = mapPatient(pData.patient || pData);
      if (rData && (rData.items || Array.isArray(rData))) {
        patient.messages = (rData.items || rData).map(mapRequest);
      }
      return patient;
    },

    async registerPatient(d) {
      const data = await apiFetch("/api/patients", {
        method: "POST",
        body: JSON.stringify({
          first_name: d.firstName,
          surname: d.surname,
          id_type: d.idType,
          id_number: d.idNumber,
          country: d.country,
          date_of_birth: d.dob,
          phone: d.phone,
          email: d.email,
          address: d.address,
          password: d.password,
          consent: true
        })
      });
      return mapPatient(data.patient || data);
    },

    async setDigitised(patientNo, value) {
      const data = await apiFetch(`/api/patients/${encodeURIComponent(patientNo)}`, {
        method: "PATCH",
        body: JSON.stringify({ digitised: Boolean(value) })
      });
      return mapPatient(data.patient || data);
    },

    // ---------- requests (messages) ----------
    async getMessages(status = "all") {
      const params = new URLSearchParams({ size: "100" });
      if (status && status !== "all") params.set("status", status);
      const data = await apiFetch(`/api/requests?${params}`);
      return (data.items || data).map(mapRequest);
    },

    async createMessage(d) {
      const data = await apiFetch("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          patient_no: d.patientNo,
          channel: d.channel,
          category: d.category,
          subject: d.subject,
          body: d.body,
          urgency: d.urgency || "routine"
        })
      });
      return mapRequest(data.request || data);
    },

    async updateMessage(id, changes) {
      const payload = {};
      if (changes.status !== undefined) payload.status = changes.status;
      if (changes.urgency !== undefined) payload.urgency = changes.urgency;
      if (changes.adminNote !== undefined) payload.admin_note = changes.adminNote;
      if (changes.response !== undefined) payload.response = changes.response;

      const data = await apiFetch(`/api/requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      return mapRequest(data.request || data);
    },

    // ---------- documents ----------
    async addDocument(patientNo, meta, file) {
      if (file) {
        if (!ALLOWED_TYPES.includes(file.type)) throw apiError(`${file.name} is not a PDF, JPG or PNG.`, 415);
        if (file.size > MAX_FILE_MB * 1024 * 1024) throw apiError(`${file.name} is bigger than ${MAX_FILE_MB} MB.`, 413);
      }
      const fd = new FormData();
      if (file) fd.append("file", file);
      fd.append("doc_type", meta.type || "");
      fd.append("note", meta.note || "");
      fd.append("completes_file", meta.completesFile ? "true" : "false");

      return apiFetch(`/api/patients/${encodeURIComponent(patientNo)}/documents`, {
        method: "POST",
        body: fd
      });
    },

    async getDocumentFile(_patientNo, docId) {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/file`, {
        credentials: "same-origin"
      });
      if (!res.ok) throw apiError("Could not load file.", res.status);
      const blob = await res.blob();
      const disp = res.headers.get("content-disposition") || "";
      const match = disp.match(/filename="?([^"]+)"?/i);
      return { blob, name: match ? match[1] : `document-${docId}` };
    },

    deleteDocument(_patientNo, docId) {
      return apiFetch(`/api/documents/${encodeURIComponent(docId)}`, {
        method: "DELETE"
      });
    },

    // ---------- KPIs ----------
    async getStats() {
      const d = await apiFetch("/api/kpis/live");
      const reqs = d.requests || {};
      return {
        patients: d.patients ?? 0,
        digitisedPatients: d.digitised_patients ?? 0,
        new: reqs.new ?? 0,
        forwarded: reqs.forwarded ?? 0,
        completed: reqs.completed ?? 0,
        urgentOpen: d.urgent_open ?? 0,
        avgResponseHours: d.avg_hours_to_complete ?? 0,
        byChannel: d.by_channel || {}
      };
    },

    async getRetrievalKpis(inputs = {}) {
      const params = new URLSearchParams();
      if (inputs.retrievalsPerDay !== undefined) params.set("retrievals_per_day", inputs.retrievalsPerDay);
      if (inputs.delayRate !== undefined) params.set("delay_rate", inputs.delayRate);
      if (inputs.extraMinutesPerDelay !== undefined) params.set("extra_minutes_per_delay", inputs.extraMinutesPerDelay);
      if (inputs.baseMinutes !== undefined) params.set("base_minutes", inputs.baseMinutes);
      if (inputs.digitalLookupMinutes !== undefined) params.set("digital_lookup_minutes", inputs.digitalLookupMinutes);
      if (inputs.adminRatePerHour !== undefined) params.set("admin_rate_per_hour", inputs.adminRatePerHour);
      if (inputs.workingDaysPerMonth !== undefined) params.set("working_days_per_month", inputs.workingDaysPerMonth);
      if (inputs.digitisedShare !== undefined) params.set("digitised_share", inputs.digitisedShare);
      return apiFetch(`/api/kpis/retrieval?${params}`);
    },

    resetDemo() {
      return Promise.reject(apiError("Demo reset is disabled when connected to MySQL.", 400));
    }
  };
})();
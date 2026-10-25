/* ==========================================================
   MediLink - data layer (stand-in for the Flask API)

   Every page gets its data through MediLinkAPI below.
   Right now it reads and writes sample data saved in the
   browser (localStorage). In the final project each function
   gets swapped for a fetch() call to the Flask back end, and
   the pages do not need to change, because they already
   wait for a Promise like a real network call.

   Planned endpoints are noted above each function.
   ========================================================== */

const MediLinkAPI = (() => {
  const STORAGE_KEY = "medilink-demo-v3";
  const SESSION_KEY = "medilink-session";
  const DEMO_PATIENT_PASSWORD = "Patient@123";
  const FAKE_DELAY_MS = 250; // makes loading spinners visible, like a real network

  // ---------- helpers ----------
  const daysAgo = (d, h = 9, m = 0) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  };
  const saIdToDob = id => {
    const yy = +id.slice(0, 2);
    return `${yy > new Date().getFullYear() % 100 ? 1900 + yy : 2000 + yy}-${id.slice(2, 4)}-${id.slice(4, 6)}`;
  };
  const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ---------- sample (seed) data ----------
  // All people below are made up. ID numbers are fake but pass the SA ID check.
  function buildSeed() {
    const seed = buildSeedData();
    // Demo staff accounts (fixed). Passwords are stored only as hashes.
    seed.staff = [
      { username: "admin", name: "Practice administrator", role: "admin", passwordHash: hashPassword("admin", "Admin@123") },
      { username: "neuro", name: "Dr Neurologist", role: "neurologist", passwordHash: hashPassword("neuro", "Neuro@123") }
    ];
    // Every sample patient gets the same demo password
    seed.patients.forEach(p => {
      p.idType = p.idType || "SA ID";
      p.country = p.country || "South Africa";
      p.dob = p.dob || saIdToDob(p.idNumber);
      p.passwordHash = hashPassword(p.patientNo, DEMO_PATIENT_PASSWORD);
      p.documents.forEach((doc, i) => { doc.id = `${p.patientNo}-seed-${i}`; doc.hasFile = false; });
    });
    return seed;
  }

  function buildSeedData() {
    return {
      nextPatientSeq: 1010,
      nextMessageSeq: 5013,
      patients: [
        {
          patientNo: "ML-1001", idNumber: "6804125254085", firstName: "Johan", surname: "van Wyk",
          email: "johan.vanwyk@example.com", phone: "0821234567",
          address: "14 Jacaranda Street, Hatfield, Pretoria, 0083",
          createdAt: daysAgo(40), digitised: true,
          history: [
            { date: daysAgo(400), type: "Consultation", note: "Initial assessment for recurring headaches. MRI requested." },
            { date: daysAgo(380), type: "EEG", note: "Routine EEG, no abnormal findings." },
            { date: daysAgo(120), type: "Follow-up", note: "Migraine frequency down after medication change." }
          ],
          documents: [
            { name: "MRI_report_2025.pdf", type: "Imaging report", date: daysAgo(390) },
            { name: "EEG_results.pdf", type: "EEG report", date: daysAgo(380) },
            { name: "Scanned_paper_file_part1.pdf", type: "Scanned paper record", date: daysAgo(40) }
          ]
        },
        {
          patientNo: "ML-1002", idNumber: "7509236766088", firstName: "Thandi", surname: "Mokoena",
          email: "thandi.m@example.com", phone: "0739876543",
          address: "7 Protea Avenue, Midstream Estate, Centurion, 1692",
          createdAt: daysAgo(35), digitised: true,
          history: [
            { date: daysAgo(200), type: "Consultation", note: "Numbness in left hand. Nerve conduction study booked." },
            { date: daysAgo(185), type: "Nerve conduction", note: "Mild carpal tunnel syndrome confirmed." }
          ],
          documents: [
            { name: "NCS_report.pdf", type: "Test report", date: daysAgo(185) }
          ]
        },
        {
          patientNo: "ML-1003", idNumber: "8201170174086", firstName: "Pieter", surname: "Botha",
          email: "pbotha@example.com", phone: "0845551234",
          address: "22 Lynnwood Road, Lynnwood, Pretoria, 0081",
          createdAt: daysAgo(30), digitised: false,
          history: [
            { date: daysAgo(900), type: "Consultation", note: "Long-standing epilepsy patient. On anti-seizure medication." },
            { date: daysAgo(500), type: "EEG", note: "Follow-up EEG, stable." }
          ],
          documents: []
        },
        {
          patientNo: "ML-1004", idNumber: "5903058196080", firstName: "Margaret", surname: "Naidoo",
          email: "m.naidoo@example.com", phone: "0827778888",
          address: "3 Oak Lane, Waterkloof, Pretoria, 0145",
          createdAt: daysAgo(28), digitised: true,
          history: [
            { date: daysAgo(700), type: "Consultation", note: "Memory concerns raised by family. Cognitive screening done." },
            { date: daysAgo(350), type: "Follow-up", note: "Gradual decline noted. Care facility liaison started." }
          ],
          documents: [
            { name: "Cognitive_assessment.pdf", type: "Assessment", date: daysAgo(700) },
            { name: "Care_facility_letter.pdf", type: "Correspondence", date: daysAgo(340) }
          ]
        },
        {
          patientNo: "ML-1005", idNumber: "9106285696080", firstName: "Lerato", surname: "Dlamini",
          email: "lerato.dlamini@example.com", phone: "0761112222",
          address: "18 Burnett Street, Hatfield, Pretoria, 0083",
          createdAt: daysAgo(20), digitised: false,
          history: [
            { date: daysAgo(60), type: "Consultation", note: "New patient. Dizziness and visual aura." }
          ],
          documents: []
        },
        {
          patientNo: "ML-1006", idNumber: "4708110619081", firstName: "Hendrik", surname: "Steyn",
          email: "hsteyn@example.com", phone: "0823334444",
          address: "41 Atterbury Road, Menlo Park, Pretoria, 0081",
          createdAt: daysAgo(15), digitised: false,
          history: [
            { date: daysAgo(1500), type: "Consultation", note: "Parkinson's disease diagnosed." },
            { date: daysAgo(800), type: "Follow-up", note: "Medication adjusted for tremor." },
            { date: daysAgo(1200), type: "Report", note: "Full neurological report written." }
          ],
          documents: []
        },
        {
          patientNo: "ML-1007", idNumber: "8802143138080", firstName: "Aisha", surname: "Patel",
          email: "aisha.patel@example.com", phone: "0715556666",
          address: "9 Duncan Street, Brooklyn, Pretoria, 0181",
          createdAt: daysAgo(8), digitised: true,
          history: [
            { date: daysAgo(90), type: "Consultation", note: "Sleep disturbance and daytime fatigue." },
            { date: daysAgo(75), type: "EEG", note: "Sleep-deprived EEG done." }
          ],
          documents: [
            { name: "Sleep_EEG.pdf", type: "EEG report", date: daysAgo(75) }
          ]
        },
        {
          patientNo: "ML-1008", idNumber: "6307301544089", firstName: "Sipho", surname: "Khumalo",
          email: "sipho.k@example.com", phone: "0839990000",
          address: "56 Garsfontein Road, Moreleta Park, Pretoria, 0044",
          createdAt: daysAgo(3), digitised: false,
          history: [
            { date: daysAgo(1000), type: "Consultation", note: "Stroke follow-up. Right-sided weakness improving." }
          ],
          documents: []
        },
        {
          patientNo: "ML-1009", idType: "Passport", idNumber: "FN482913", country: "Zimbabwe", dob: "1986-03-14",
          firstName: "Tendai", surname: "Moyo",
          email: "tendai.moyo@example.com", phone: "+263771234567",
          address: "12 Festival Street, Hatfield, Pretoria, 0083",
          createdAt: daysAgo(2), digitised: false,
          history: [
            { date: daysAgo(30), type: "Consultation", note: "Referred by GP for recurring numbness in both feet." }
          ],
          documents: []
        }
      ],
      messages: [
        { id: 5001, patientNo: "ML-1006", channel: "Email", category: "Referral / report request",
          subject: "Urgent referral letter for neurosurgery", body: "Good day. I have been referred for a neurosurgical evaluation and need a referral letter with my full history by tomorrow morning.",
          createdAt: hoursAgo(3), status: "forwarded", urgency: "urgent", adminNote: "Paper file. Needs full history, not the old report.", response: "", completedAt: null },
        { id: 5002, patientNo: "ML-1002", channel: "Patient portal", category: "Prescription question",
          subject: "Repeat script for splint and medication", body: "Hi, can I get a repeat prescription? My pharmacy says the old one expired.",
          createdAt: hoursAgo(5), status: "new", urgency: "soon", adminNote: "", response: "", completedAt: null },
        { id: 5003, patientNo: "ML-1005", channel: "Phone", category: "New symptoms",
          subject: "Dizziness getting worse", body: "Patient phoned. Dizziness now daily and she had a fall yesterday.",
          createdAt: hoursAgo(2), status: "new", urgency: "urgent", adminNote: "", response: "", completedAt: null },
        { id: 5004, patientNo: "ML-1001", channel: "Patient portal", category: "Follow-up appointment",
          subject: "Book 6-month follow-up", body: "Please book my six-month follow-up. Mornings work best.",
          createdAt: daysAgo(1, 10, 15), status: "new", urgency: "routine", adminNote: "", response: "", completedAt: null },
        { id: 5005, patientNo: "ML-1004", channel: "Email", category: "Referral / report request",
          subject: "Report for curatorship application", body: "Our attorney needs an updated report for my mother's curatorship application.",
          createdAt: daysAgo(1, 14, 40), status: "forwarded", urgency: "soon", adminNote: "Sent by daughter. Attorney deadline end of next week.", response: "", completedAt: null },
        { id: 5006, patientNo: "ML-1003", channel: "In person", category: "Prescription question",
          subject: "Change in seizure medication side effects", body: "Patient at reception. Feeling drowsy since dose change.",
          createdAt: daysAgo(1, 9, 5), status: "forwarded", urgency: "routine", adminNote: "", response: "", completedAt: null },
        { id: 5007, patientNo: "ML-1007", channel: "Patient portal", category: "Test results",
          subject: "EEG results question", body: "Could the doctor explain what my sleep EEG results mean?",
          createdAt: daysAgo(2, 11, 0), status: "completed", urgency: "routine", adminNote: "", response: "Results explained by email. No further action.", completedAt: daysAgo(1, 16, 0) },
        { id: 5008, patientNo: "ML-1008", channel: "Phone", category: "Follow-up appointment",
          subject: "Wife phoned to book follow-up", body: "Wife of patient asked for next available follow-up slot.",
          createdAt: daysAgo(2, 15, 30), status: "completed", urgency: "routine", adminNote: "", response: "Booked for next Tuesday 10:00.", completedAt: daysAgo(2, 16, 10) },
        { id: 5009, patientNo: "ML-1001", channel: "Email", category: "Other",
          subject: "Medical aid claim form", body: "My medical aid needs a signed claim form for the MRI.",
          createdAt: daysAgo(4, 8, 30), status: "completed", urgency: "routine", adminNote: "", response: "Form signed and emailed.", completedAt: daysAgo(3, 12, 0) },
        { id: 5010, patientNo: "ML-1002", channel: "Email", category: "Test results",
          subject: "Nerve study copy for GP", body: "Please send a copy of my nerve conduction study to my GP.",
          createdAt: daysAgo(5, 13, 0), status: "completed", urgency: "soon", adminNote: "", response: "Sent to GP practice.", completedAt: daysAgo(5, 15, 30) },
        { id: 5011, patientNo: "ML-1004", channel: "Phone", category: "Other",
          subject: "Care facility asking about medication times", body: "Care facility nurse phoned about medication timing.",
          createdAt: hoursAgo(26), status: "new", urgency: "soon", adminNote: "", response: "", completedAt: null },
        { id: 5012, patientNo: "ML-1006", channel: "In person", category: "Follow-up appointment",
          subject: "Tremor review booking", body: "Patient asked at reception for a tremor review.",
          createdAt: daysAgo(6, 10, 0), status: "completed", urgency: "routine", adminNote: "", response: "Booked.", completedAt: daysAgo(6, 11, 0) }
      ]
    };
  }

  // ---------- storage ----------
  let db = null;
  function loadDb() {
    if (db) return db;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { db = JSON.parse(raw); return db; }
    } catch (e) { /* storage blocked, fall back to seed */ }
    db = buildSeed();
    saveDb();
    return db;
  }
  function saveDb() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  }

  // Wraps a result in a Promise with a small delay, like a real API call
  function respond(fn) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try { resolve(clone(fn(loadDb()))); }
        catch (err) { reject(err); }
      }, FAKE_DELAY_MS);
    });
  }
  function apiError(message, status = 400) {
    const e = new Error(message); e.status = status; return e;
  }

  // ---------- file storage (scanned documents) ----------
  // Real files are kept in IndexedDB, the browser's built-in database,
  // because localStorage is far too small for PDFs. In the Flask stage
  // these move to the server (e.g. an uploads folder or cloud storage).
  const FILE_DB = "medilink-files", FILE_STORE = "documents";
  function openFileDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(apiError("This browser can't store files.", 500));
      const req = indexedDB.open(FILE_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(FILE_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(apiError("Could not open file storage.", 500));
    });
  }
  async function fileOp(mode, fn) {
    const dbh = await openFileDb();
    return new Promise((resolve, reject) => {
      const tx = dbh.transaction(FILE_STORE, mode);
      const req = fn(tx.objectStore(FILE_STORE));
      tx.oncomplete = () => { resolve(req && req.result); dbh.close(); };
      tx.onerror = tx.onabort = () => {
        const quota = tx.error && tx.error.name === "QuotaExceededError";
        reject(apiError(quota ? "The browser is out of storage space. Remove some files or reset the demo." : "Saving the file failed.", 507));
        dbh.close();
      };
    });
  }
  const MAX_FILE_MB = 20;
  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

  const findPatient = (d, patientNo) => d.patients.find(p => p.patientNo === patientNo);
  const withPatient = (d, m) => {
    const p = findPatient(d, m.patientNo);
    return { ...m, patientName: p ? `${p.firstName} ${p.surname}` : "Unknown patient", digitised: p ? p.digitised : false };
  };
  // Never send password hashes to the pages
  const safePatient = p => { const { passwordHash, ...rest } = p; return rest; };

  // ---------- session (who is logged in) ----------
  // Kept per browser tab. Closing the browser logs everyone out,
  // which suits a shared reception computer.
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; }
  }
  function setSession(s) {
    try { s ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) : sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // Role check done "on the server side" of the API, not just by hiding links.
  // The Flask version will do the same with @login_required and role checks.
  const STAFF = ["admin", "neurologist"];
  function requireRole(roles) {
    const s = getSession();
    if (!s) throw apiError("Please log in first.", 401);
    if (!roles.includes(s.role)) throw apiError("You don't have access to this.", 403);
    return s;
  }
  function requireStaffOrSelf(patientNo) {
    const s = getSession();
    if (!s) throw apiError("Please log in first.", 401);
    if (STAFF.includes(s.role)) return s;
    if (s.role === "patient" && s.patientNo === patientNo) return s;
    throw apiError("You can only view your own record.", 403);
  }

  return {
    // ---------- auth ----------
    // POST /api/auth/login   body: { role, username, password }
    login(role, username, password) {
      return respond(d => {
        const user = String(username || "").trim();
        const fail = () => apiError("Incorrect username or password.", 401);
        let session;
        if (role === "patient") {
          const p = findPatient(d, user.toUpperCase());
          if (!p || p.passwordHash !== hashPassword(p.patientNo, password)) throw fail();
          session = { role: "patient", username: p.patientNo, patientNo: p.patientNo, name: `${p.firstName} ${p.surname}` };
        } else {
          const s = d.staff.find(x => x.username.toLowerCase() === user.toLowerCase());
          if (!s || s.passwordHash !== hashPassword(s.username, password)) throw fail();
          if (s.role !== role) throw apiError(`This is not a${role === "admin" ? "n admin" : " neurologist"} account. Go back and choose the right role.`, 403);
          session = { role: s.role, username: s.username, name: s.name };
        }
        setSession(session);
        return session;
      });
    },

    // POST /api/auth/logout
    logout() { setSession(null); return Promise.resolve(true); },

    // GET /api/auth/me
    currentUser() { return getSession(); },

    // ---------- patients ----------
    // GET /api/patients?search=        (staff only)
    getPatients(search = "") {
      return respond(d => {
        requireRole(STAFF);
        const q = search.trim().toLowerCase();
        const list = !q ? d.patients : d.patients.filter(p =>
          p.patientNo.toLowerCase().includes(q) ||
          p.idNumber.toLowerCase().includes(q) ||
          `${p.firstName} ${p.surname}`.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q));
        return list.map(safePatient);
      });
    },

    // GET /api/patients/<patientNo>    (staff, or the patient themself)
    getPatient(patientNo) {
      return respond(d => {
        requireStaffOrSelf(patientNo);
        const p = findPatient(d, patientNo);
        if (!p) throw apiError("Patient not found", 404);
        const messages = d.messages.filter(m => m.patientNo === patientNo)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { ...safePatient(p), messages };
      });
    },

    // POST /api/patients  (new patient intake - public, or staff at reception)
    registerPatient(data) {
      return respond(d => {
        const s = getSession();
        if (s && s.role === "patient") throw apiError("You are already registered. Log out first to register someone else.", 403);
        const idType = data.idType || "SA ID";
        const sameDoc = p => (p.idType || "SA ID") === idType && p.idNumber === data.idNumber &&
          (idType === "SA ID" || (p.country || "").toLowerCase() === (data.country || "").toLowerCase());
        if (d.patients.some(sameDoc)) {
          throw apiError(`This ${idType === "Passport" ? "passport" : "ID number"} is already registered. Please log in with your patient number instead.`, 409);
        }
        const patientNo = `ML-${d.nextPatientSeq++}`;
        const patient = {
          patientNo,
          idType, idNumber: data.idNumber, country: data.country || "South Africa", dob: data.dob || "",
          firstName: data.firstName, surname: data.surname,
          email: data.email, phone: data.phone, address: data.address,
          createdAt: new Date().toISOString(), digitised: false, history: [], documents: [],
          passwordHash: hashPassword(patientNo, data.password)
        };
        d.patients.push(patient); saveDb();
        return safePatient(patient);
      });
    },

    // ---------- messages ----------
    // GET /api/messages?status=        (staff only)
    getMessages(status = "all") {
      return respond(d => {
        requireRole(STAFF);
        return d.messages
          .filter(m => status === "all" || m.status === status)
          .map(m => withPatient(d, m));
      });
    },

    // POST /api/messages   (staff, or a patient for their own record)
    createMessage(data) {
      return respond(d => {
        const s = requireStaffOrSelf(data.patientNo);
        if (!findPatient(d, data.patientNo)) throw apiError("Patient not found", 404);
        const msg = {
          id: d.nextMessageSeq++, patientNo: data.patientNo,
          channel: s.role === "patient" ? "Patient portal" : data.channel,
          category: data.category, subject: data.subject, body: data.body,
          createdAt: new Date().toISOString(), status: "new",
          urgency: data.urgency || "routine", adminNote: "", response: "", completedAt: null
        };
        d.messages.push(msg); saveDb();
        return withPatient(d, msg);
      });
    },

    // PATCH /api/messages/<id>          (staff only)
    updateMessage(id, changes) {
      return respond(d => {
        requireRole(STAFF);
        const m = d.messages.find(x => x.id === Number(id));
        if (!m) throw apiError("Request not found", 404);
        Object.assign(m, changes);
        if (changes.status === "completed" && !m.completedAt) m.completedAt = new Date().toISOString();
        saveDb();
        return withPatient(d, m);
      });
    },

    // POST /api/patients/<patientNo>/documents   (staff only, multipart upload)
    // meta = { type, note, completesFile }   file = File from the upload box
    async addDocument(patientNo, meta, file) {
      requireRole(STAFF);
      if (!findPatient(loadDb(), patientNo)) throw apiError("Patient not found", 404);
      if (file) {
        if (!ALLOWED_TYPES.includes(file.type)) throw apiError(`${file.name} is not a PDF, JPG or PNG.`, 415);
        if (file.size > MAX_FILE_MB * 1024 * 1024) throw apiError(`${file.name} is bigger than ${MAX_FILE_MB} MB.`, 413);
      }
      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (file) await fileOp("readwrite", store => store.put(file, id));
      return respond(d => {
        const p = findPatient(d, patientNo);
        const s = getSession();
        p.documents.push({
          id, name: file ? file.name : meta.name, type: meta.type, note: meta.note || "",
          size: file ? file.size : 0, mime: file ? file.type : "", hasFile: !!file,
          uploadedBy: s ? s.name : "", date: new Date().toISOString()
        });
        if (meta.completesFile) p.digitised = true;
        saveDb();
        return safePatient(p);
      });
    },

    // GET /api/patients/<patientNo>/documents/<id>   (staff only) - returns the file
    async getDocumentFile(patientNo, docId) {
      requireRole(STAFF);
      const p = findPatient(loadDb(), patientNo);
      const doc = p && p.documents.find(x => x.id === docId);
      if (!doc || !doc.hasFile) throw apiError("File not found", 404);
      const blob = await fileOp("readonly", store => store.get(docId));
      if (!blob) throw apiError("The file is missing from this browser's storage.", 404);
      return { blob, name: doc.name };
    },

    // DELETE /api/patients/<patientNo>/documents/<id>   (staff only)
    async deleteDocument(patientNo, docId) {
      requireRole(STAFF);
      await fileOp("readwrite", store => store.delete(docId)).catch(() => {});
      return respond(d => {
        const p = findPatient(d, patientNo);
        if (!p) throw apiError("Patient not found", 404);
        p.documents = p.documents.filter(x => x.id !== docId);
        saveDb();
        return safePatient(p);
      });
    },

    MAX_FILE_MB, ALLOWED_TYPES,

    // PATCH /api/patients/<patientNo>   (staff only)
    setDigitised(patientNo, value) {
      return respond(d => {
        requireRole(STAFF);
        const p = findPatient(d, patientNo);
        if (!p) throw apiError("Patient not found", 404);
        p.digitised = value; saveDb();
        return safePatient(p);
      });
    },

    // GET /api/stats   (staff only)
    getStats() {
      return respond(d => {
        requireRole(STAFF);
        const msgs = d.messages;
        const done = msgs.filter(m => m.completedAt);
        const avgHours = done.length
          ? done.reduce((s, m) => s + (new Date(m.completedAt) - new Date(m.createdAt)), 0) / done.length / 3600000
          : 0;
        const byChannel = {};
        msgs.forEach(m => { byChannel[m.channel] = (byChannel[m.channel] || 0) + 1; });
        return {
          patients: d.patients.length,
          digitisedPatients: d.patients.filter(p => p.digitised).length,
          new: msgs.filter(m => m.status === "new").length,
          forwarded: msgs.filter(m => m.status === "forwarded").length,
          completed: msgs.filter(m => m.status === "completed").length,
          urgentOpen: msgs.filter(m => m.urgency === "urgent" && m.status !== "completed").length,
          avgResponseHours: avgHours,
          byChannel
        };
      });
    },

    // Demo only - puts the sample data back (staff only)
    async resetDemo() {
      requireRole(STAFF);
      db = buildSeed(); saveDb();
      await fileOp("readwrite", store => store.clear()).catch(() => {});
      return true;
    }
  };
})();

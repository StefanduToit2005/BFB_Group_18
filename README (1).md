# MediLink front end

BFB 321 Supply Chain Technologies. Step 1 of the web app guide, the front end build.

MediLink links every patient request (portal, email, phone, walk-in) to one digital patient record keyed on a unique patient number. This replaces matching emails to names by hand and searching an archive of 80,000 paper files.

Built with HTML, CSS, Bootstrap 5.3 and plain JavaScript. No install or build step is needed.

---

## How to run it in VS Code

1. Unzip the folder and open it in VS Code (File, then Open Folder).
2. Install the **Live Server** extension (by Ritwick Dey) from the Extensions tab.
3. Right-click `index.html` and choose **Open with Live Server**.
4. The site opens in your browser and reloads every time you save a file.

You need internet the first time, because Bootstrap, the icons and Chart.js load from a CDN.

**Other option.** Since Python is installed, you can also run `python -m http.server 8000` in the VS Code terminal and go to `http://localhost:8000`.

---

## Pages and the main flows

| Page | Who uses it | What it does |
|---|---|---|
| `index.html` | Everyone | Home page with the four views and how a request flows |
| `patient-register.html` | New patient | Intake form with validation. Creates a unique patient number (ML-1234) |
| `patient-portal.html` | Returning patient | Log in with patient number and email, send a request, track its status |
| `admin.html` | Administrator | Request queue with filters, search, sorting, urgency, notes, forward to neurologist, log phone and walk-in requests |
| `patients.html` | Administrator | Instant patient lookup by number, ID, name or email |
| `patient-file.html` | Admin and neurologist | Digital patient file with details, requests, history and documents. Paper files can be scanned in |
| `neurologist.html` | Neurologist | Forwarded requests sorted by urgency, then waiting time. Complete with a reply the patient sees |
| `dashboard.html` | Practice / report | Before and after KPI table and charts for retrieval time and cost, plus live counts from the app |

### The three end-to-end flows to demo

1. **New patient intake.** Register, get a patient number, log in to the portal, send a request.
2. **Request fulfilment.** Admin sees the request already linked to the patient, sets urgency, adds a note, forwards it. The neurologist opens the file in one click and completes it. The patient sees the reply in the portal.
3. **Phone or walk-in request.** Admin logs it, searches the patient by number, ID or name, and it joins the same queue.

**Demo login.** Patient number `ML-1001`, email `johan.vanwyk@example.com`

Click **Reset demo data** in the footer at any time to put the sample data back.

---

## How it maps to the guide checklist

| Guide asks for | Where it is |
|---|---|
| Responsive, mobile-friendly pages for each main flow | Bootstrap grid on every page. Tables turn into stacked cards on phones |
| Accessible forms and tables | Labels on every field, skip link, visible focus ring, table captions, keyboard row opening, ARIA live regions |
| Form validation and helpful error messages | SA ID number check (13 digits, date, check digit), 10-digit phone, email, postal code, duplicate ID warning, wrong login message |
| Reusable components (navbar, tables, cards) | `js/components.js` builds the navbar, footer, badges, toasts and state blocks once for all pages |
| Consistent typography and spacing scale | One type scale and one spacing scale in `css/styles.css` |
| Empty, loading and error states | Spinners while loading, friendly empty messages, error messages if a patient is not found |
| Metrics and KPIs on the front end | Admin KPI tiles, neurologist urgency counts, impact dashboard |

---

## Folder layout

```
medilink-frontend/
├── index.html, patient-register.html, patient-portal.html,
│   admin.html, patients.html, patient-file.html,
│   neurologist.html, dashboard.html
├── css/
│   └── styles.css         brand colours, spacing, mobile table layout
└── js/
    ├── data.js            sample data + MediLinkAPI (stand-in for Flask)
    ├── components.js      navbar, footer, badges, validation helpers
    ├── kpi-model.js       retrieval time and cost formulas
    └── one .js file per page
```

---

## For the supply chain model (teammate)

`js/kpi-model.js` holds the same maths the Python model should do. Keep both in sync.

- Average paper retrieval time = best case + delay rate × extra minutes per delay
- Delay hours per day = retrievals × delay rate × (1 − digitised share) × extra minutes ÷ 60
- Cost per month = delay hours per day × admin rate × working days per month
- With MediLink, digitised files take the digital lookup time and have no delays

Default inputs come from the neurologist interview (22 retrievals a day, 45% delayed, 10 extra minutes, R78 an hour, 22 working days). The digital lookup time of 1 minute is an assumption. At 100% digitised this gives 1.65 hours and about R2,830 a month. The proposal says R2,900 because it rounded the hours to 1.7 first.

---

## Moving to Flask later (final project)

The pages never touch the data directly. They all go through `MediLinkAPI` in `js/data.js`, and every function already returns a Promise like a real network call. The planned endpoint is written above each function, for example `GET /api/patients/<patientNo>`.

To connect the back end, replace the inside of each function with a `fetch()` call to that endpoint. The pages themselves should not need changes. The HTML pages can then move into Flask's `templates/` folder and `css/` and `js/` into `static/`, with the navbar becoming `base.html`.

---

All patient data in this prototype is made up.

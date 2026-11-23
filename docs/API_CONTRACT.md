# MediLink API contract

Owner: Joshua (API and back end)
Agreed with: Stefan (database), Tendaishe (front end)
Status: DRAFT, please check and reply before we build

This file says exactly what each endpoint accepts and returns, so the database, the API and the front end fit together. If something here needs to change, change it in this file first and tell the group.

---

## 1. General rules

- Base path for every endpoint is `/api`.
- Requests and responses are JSON, except file uploads and downloads.
- Field names use `snake_case`, for example `patient_no`, `created_at`.
- Dates are ISO 8601 text, for example `2026-11-22T14:05:00`.
- Login uses a Flask session cookie. The front end must send `credentials: "same-origin"` with `fetch`.

### Status codes

| Code | When |
|---|---|
| 200 | Read or update worked |
| 201 | Something was created |
| 400 | Input missing, wrong type or out of range |
| 401 | Not logged in, or wrong username or password |
| 403 | Logged in but this role may not do this |
| 404 | Record not found |
| 409 | Duplicate, for example an ID number that is already registered |
| 413 / 415 | Upload too big / wrong file type |
| 500 | Server error (logged, never shows a stack trace) |

### Error shape (every error looks like this)

```json
{ "error": { "code": 400, "message": "Phone number must be 10 digits starting with 0, or start with +.", "field": "phone" } }
```

`field` is only included when one input caused the error, so the front end can put the message under that field.

### Paged list shape (every list endpoint looks like this)

```json
{ "items": [ ... ], "page": 1, "size": 20, "total": 57, "pages": 3 }
```

Query parameters `page` (from 1) and `size` (1 to 100, default 20). Bad values return 400.

### Roles

| Role | Can do |
|---|---|
| `patient` | Own record and own requests only |
| `admin` | All patients, requests and documents. Not the impact dashboard |
| `neurologist` | Everything |

---

## 2. Endpoints

### Auth

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | Anyone | Log in |
| POST | `/api/auth/logout` | Logged in | Log out |
| GET | `/api/auth/me` | Logged in | Who is logged in |

`POST /api/auth/login`
```json
// request
{ "role": "patient", "username": "ML-1001", "password": "Patient@123" }
// 200 response
{ "user": { "role": "patient", "username": "ML-1001", "name": "Johan van Wyk", "patient_no": "ML-1001" } }
```
401 for a wrong username or password. 403 if the account is a different role than the one chosen.

### Patients

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/patients` | Staff | List and search patients (paged) |
| GET | `/api/patients/<patient_no>` | Staff, or that patient | One patient with history and document list |
| POST | `/api/patients` | Anyone not logged in, or staff | Register a new patient |
| PATCH | `/api/patients/<patient_no>` | Staff | Update contact details or digitised status |

`GET /api/patients?search=botha&digitised=false&page=1&size=20`
- `search` matches patient number, ID or passport number, name or email
- `digitised` is `true` or `false`

`POST /api/patients`
```json
// request
{
  "first_name": "Farai", "surname": "Ncube",
  "id_type": "Passport", "id_number": "FN991234", "country": "Zimbabwe", "date_of_birth": "1990-05-20",
  "phone": "+263775551234", "email": "farai@example.com",
  "address": "3 Park St, Pretoria, 0083",
  "password": "Farai2026", "consent": true
}
// 201 response
{ "patient": { "patient_no": "ML-1010", "first_name": "Farai", "surname": "Ncube", "...": "..." } }
```
Checks: SA ID must pass the 13-digit check digit test. Passport needs country and date of birth. Password at least 8 characters with a letter and a number. `consent` must be true. Duplicate ID or passport returns 409.

`PATCH /api/patients/<patient_no>`
```json
{ "phone": "0821234567", "email": "new@example.com", "address": "...", "digitised": true }
```
Any subset of these fields. Password hashes are never returned by any endpoint.

### Requests (patient messages)

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/requests` | Staff | Request queue (paged, filtered) |
| GET | `/api/requests/<id>` | Staff, or the patient it belongs to | One request |
| POST | `/api/requests` | Patient for self, or staff for any patient | New request |
| PATCH | `/api/requests/<id>` | Staff | Change status, urgency, note or reply |
| GET | `/api/patients/<patient_no>/requests` | Staff, or that patient | One patient's requests |

`GET /api/requests?status=new&urgency=urgent&channel=Phone&search=botha&sort=urgency&page=1&size=20`
- `status` is `new`, `forwarded` or `completed`
- `urgency` is `urgent`, `soon` or `routine`
- `channel` is `Patient portal`, `Email`, `Phone` or `In person`
- `sort` is `created_at` (default, newest first) or `urgency`

`POST /api/requests`
```json
// request
{ "patient_no": "ML-1001", "channel": "Phone", "category": "New symptoms",
  "subject": "Headaches every morning", "body": "Started a week ago.", "urgency": "urgent" }
// 201 response
{ "request": { "id": 5013, "patient_no": "ML-1001", "patient_name": "Johan van Wyk", "status": "new", "...": "..." } }
```
A patient's own request always gets channel `Patient portal`, whatever is sent.

`PATCH /api/requests/<id>`
```json
{ "status": "forwarded", "urgency": "urgent", "admin_note": "Needs full history" }
{ "status": "completed", "response": "Letter written with full history." }
```
Status can only move forward: `new` to `forwarded` to `completed`, or `new` straight to `completed`. Completing sets `completed_at`.

### Documents (scanned paper files)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/patients/<patient_no>/documents` | Staff | Upload a scan (multipart form) |
| GET | `/api/documents/<id>/file` | Staff | Open or download the file |
| DELETE | `/api/documents/<id>` | Staff | Remove a document |

Upload form fields: `file` (PDF, JPG or PNG, up to 20 MB), `doc_type`, `note`, `completes_file` (`true` marks the patient as digitised).

### KPIs and the supply chain model

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/kpis/live` | Staff | Live counts from the database |
| GET | `/api/kpis/retrieval` | Neurologist | Before and after retrieval time and cost, from the Step 2 model |
| GET | `/api/kpis/digitise-priority` | Staff | Paper-file patients ranked by how much scanning them saves |

`GET /api/kpis/live`
```json
{ "patients": 9, "digitised_patients": 4, "requests": { "new": 5, "forwarded": 3, "completed": 6 },
  "urgent_open": 2, "avg_hours_to_complete": 10.6, "by_channel": { "Email": 4, "Phone": 4 } }
```

`GET /api/kpis/retrieval?retrievals_per_day=22&delay_rate=0.45&...`
All inputs optional. If `digitised_share` is not sent, the API uses the real share of digitised patients from the database, so the KPI changes when files are scanned in. This is the flow where the model drives the app.

---

## 3. Suggested tables (for Stefan to confirm)

The API will use these exact names. Stefan, please change them here if your schema differs.

| Table | Key columns | Links |
|---|---|---|
| `staff_users` | `id` PK, `username` UNIQUE, `password_hash`, `role` (admin or neurologist), `full_name`, `created_at`, `updated_at` | |
| `patients` | `patient_no` PK (ML-1001), `id_type`, `id_number`, `country`, `date_of_birth`, `first_name`, `surname`, `email`, `phone`, `address`, `password_hash`, `digitised`, `consent_at`, `created_at`, `updated_at`. UNIQUE (`id_type`, `id_number`, `country`) | |
| `requests` | `id` PK, `patient_no` FK, `channel`, `category`, `subject`, `body`, `urgency`, `status`, `admin_note`, `response`, `completed_at`, `created_by` FK to `staff_users` (null if the patient sent it), `created_at`, `updated_at`. Index on (`status`, `urgency`) | many requests per patient |
| `documents` | `id` PK, `patient_no` FK, `file_name`, `stored_path`, `mime_type`, `size_bytes`, `doc_type`, `note`, `uploaded_by` FK to `staff_users`, `created_at` | many documents per patient |
| `medical_history` | `id` PK, `patient_no` FK, `event_date`, `event_type`, `note`, `created_at` | many entries per patient |

Uploaded files are saved in an `uploads/` folder on the server (listed in `.gitignore`). The database only stores the path.

---

## 4. Still to confirm

- [ ] Stefan, are these table and column names OK?
- [ ] Tendaishe, do these endpoints cover every screen?
- [ ] Who owns the Step 2 supply chain model file, and what is its function name?
- [ ] Folder layout matches the class sample project

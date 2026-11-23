# MediLink API (back end)

Owner: Joshua Smit (u24577155)

The back end is a Flask app that serves the HTML pages and a JSON API under `/api`.
It reads and writes the MySQL database through `db.py`, and runs the Step 2 supply
chain model (`models/retrieval.py`) for the KPI endpoints.

## How a request travels

```
Browser (fetch)  ->  routes/*.py  ->  models/*.py  ->  db.py  ->  MySQL
                     checks login,     SQL and         one connection
                     reads input,      business        per request
                     returns JSON      rules
```

Routes never contain SQL, and models never deal with HTTP. This follows the class sample project.

## Files

| File | Job |
|---|---|
| `app.py` | Creates the app, loads config, connects the database, registers blueprints, logging, error handlers |
| `routes/__init__.py` | Registers all blueprints |
| `routes/auth.py` | Login, logout, who is logged in |
| `routes/patients.py` | Patient list, read, register, update |
| `routes/patient_requests.py` | Request queue: list, read, create, update |
| `routes/documents.py` | Upload, open or download, delete scanned files |
| `routes/kpis.py` | Live counts and the supply chain model KPIs |
| `routes/pages.py` | Serves the HTML pages in `templates/` |
| `routes/errors.py` | Central error handlers, rollback on failed writes |
| `routes/helpers.py` | Login checks by role, input parsing, pagination |
| `models/users.py` | Password checks for staff and patients |
| `models/patients.py` | SQL for patients |
| `models/patient_requests.py` | SQL for requests and the status rules |
| `models/documents.py` | File checks, file storage and SQL for documents |
| `models/stats.py` | Live counts and KPIs that call `models/retrieval.py` |
| `models/validators.py` | Input checks (SA ID check digit, passport, phone, email, password) |
| `models/serialize.py` | Turns database rows into JSON-friendly dictionaries |
| `tests/` | pytest tests against a separate test database |

## Endpoints

All responses are JSON. Errors always look like
`{"error": {"code": 400, "message": "...", "field": "phone"}}`.
Lists always look like `{"items": [...], "page": 1, "size": 20, "total": 57, "pages": 3}`.

| Method | Path | Who | Purpose | Success |
|---|---|---|---|---|
| POST | `/api/auth/login` | Anyone | Log in with role, username, password | 200 |
| POST | `/api/auth/logout` | Logged in | Log out | 200 |
| GET | `/api/auth/me` | Logged in | Who is logged in | 200 |
| GET | `/api/patients` | Staff | List patients. Filters `search`, `digitised`. Paging `page`, `size` | 200 |
| POST | `/api/patients` | Anyone, or staff | Register a patient (SA ID or passport) | 201 |
| GET | `/api/patients/<patient_no>` | Staff, or that patient | One patient with history and documents | 200 |
| PATCH | `/api/patients/<patient_no>` | Staff | Update email, phone, address, digitised | 200 |
| GET | `/api/patients/<patient_no>/requests` | Staff, or that patient | One patient's requests | 200 |
| GET | `/api/requests` | Staff | Request queue. Filters `status`, `urgency`, `channel`, `search`. `sort` = `created_at` or `urgency`. Paging | 200 |
| POST | `/api/requests` | Patient for self, or staff | New request | 201 |
| GET | `/api/requests/<id>` | Staff, or the patient it belongs to | One request | 200 |
| PATCH | `/api/requests/<id>` | Staff | Change status, urgency, admin note or reply | 200 |
| POST | `/api/patients/<patient_no>/documents` | Staff | Upload a scan (form fields `file`, `doc_type`, `note`, `completes_file`) | 201 |
| GET | `/api/documents/<id>/file` | Staff | Open the file. Add `?download=1` to download | 200 |
| DELETE | `/api/documents/<id>` | Staff | Delete a document | 200 |
| GET | `/api/kpis/live` | Staff | Live counts from the database | 200 |
| GET | `/api/kpis/retrieval` | Neurologist | Before and after retrieval time and cost from the supply chain model | 200 |
| GET | `/api/kpis/digitise-priority` | Staff | Paper-file patients ranked by the saving from scanning them | 200 |

Error codes used: 400 bad input, 401 not logged in, 403 wrong role, 404 not found,
405 wrong method, 409 duplicate, 413 file too big, 415 wrong file type, 500 server error, 503 database down.

Full request and response examples are in `docs/API_CONTRACT.md`.

## Rules the API enforces

- A patient can only see and create requests for their own patient number. Their channel is always "Patient portal".
- Request status only moves forward: new, then forwarded, then completed. Completing needs a reply.
- Uploads must really be PDF, JPG or PNG (the first bytes are checked, not just the name), up to 20 MB.
- Saving a document and marking the patient digitised happen in one transaction. If either fails, both are undone and the file is removed.
- Password hashes are never sent to the front end.

## Where the supply chain model is used

`models/stats.py` calls `delayed_retrievals_per_day`, `wasted_hours_per_day` and `monthly_cost`
from `models/retrieval.py`.

1. `GET /api/kpis/retrieval` works out the cost before MediLink (all paper) and with MediLink.
   If `digitised_share` is not sent, it uses the real share of digitised patients from MySQL.
   So when admin scans in a paper file, the saving on the dashboard goes up straight away.
2. `GET /api/kpis/digitise-priority` feeds each paper-file patient's request rate into the model
   to rank which files are worth scanning first.

### `GET /api/kpis/retrieval` response

Query parameters (all optional, defaults from the interview): `retrievals_per_day`, `delay_rate` (0 to 1),
`extra_minutes`, `best_case_minutes`, `digital_lookup_minutes`, `hourly_rate`, `working_days`, `digitised_share` (0 to 1).

```json
{
  "inputs": { "retrievals_per_day": 22, "delay_rate": 0.45, "extra_minutes": 10, "best_case_minutes": 5,
              "digital_lookup_minutes": 1, "hourly_rate": 78, "working_days": 22, "digitised_share": 0.444 },
  "digitised_share_source": "database",
  "before": { "delayed_per_day": 9.9, "wasted_hours_per_day": 1.65, "total_retrieval_hours_per_day": 3.48,
              "avg_retrieval_minutes": 9.5, "monthly_cost": 2831.4, "yearly_cost": 33976.8 },
  "after":  { "...same fields...": "with MediLink" },
  "savings": { "hours_per_day": 0.73, "per_month": 1258.4, "per_year": 15100.8, "retrieval_time_cut_pct": 46.8 }
}
```

## Logging

`app.py` logs to the console and to `logs/medilink.log` (rotates at 1 MB, keeps 5 files).
Each line has the time, level and message. Logins, creates, updates, uploads and deletes are logged
at INFO, refused requests at WARNING, and crashes at ERROR with the stack trace.

## Running the tests

The tests need a second, empty MySQL database for testing, for example `medilink_test`.
Put its name in `.env` as `TEST_DB_NAME=medilink_test`. Then, with the venv active:

```
python -m pytest
```

Before every test the test database is rebuilt from `schema.sql` and `tests/test_data.sql`,
so the tests never touch real data. There are 34 API tests plus Stefan's 4 model tests.

## What the back end expects from the rest of the project

- `db.py` with `get_db`, `query_all`, `query_one`, `execute` and `init_app`, as in the class sample.
- `config.py` with a dictionary `config_by_name` holding `development`, `testing` and `production`.
- `schema.sql` using the table and column names in `docs/API_CONTRACT.md`.
- Passwords in the seed data hashed with `werkzeug.security.generate_password_hash`.
- `.gitignore` containing `.env`, `venv/`, `logs/` and `uploads/`.

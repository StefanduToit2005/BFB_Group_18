"""SQL and business rules for patients."""
import pymysql
from werkzeug.security import generate_password_hash

from db import execute, get_db, query_all, query_one
from models.serialize import clean_row, clean_rows
from routes.errors import ApiError

PATIENT_COLUMNS = """patient_no, id_type, id_number, country, date_of_birth, first_name, surname,
                     email, phone, address, digitised, created_at, updated_at"""


def list_patients(search=None, digitised=None, page=1, size=20):
    """One page of patients, filtered by search text and digitised status."""
    where, params = [], []
    if search:
        like = f"%{search}%"
        where.append("""(patient_no LIKE %s OR id_number LIKE %s OR email LIKE %s
                         OR CONCAT(first_name, ' ', surname) LIKE %s)""")
        params += [like, like, like, like]
    if digitised is not None:
        where.append("digitised = %s")
        params.append(digitised)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    total = query_one(f"SELECT COUNT(*) AS n FROM patients {where_sql}", params)["n"]
    rows = query_all(
        f"SELECT {PATIENT_COLUMNS} FROM patients {where_sql} ORDER BY patient_no LIMIT %s OFFSET %s",
        params + [size, (page - 1) * size],
    )
    return clean_rows(rows), total


def get_patient(patient_no):
    """One patient with their medical history and document list, or None."""
    row = query_one(f"SELECT {PATIENT_COLUMNS} FROM patients WHERE patient_no = %s", (patient_no,))
    if row is None:
        return None
    patient = clean_row(row)
    patient["digitised"] = bool(patient["digitised"])
    patient["history"] = clean_rows(query_all(
        "SELECT id, event_date, event_type, note FROM medical_history "
        "WHERE patient_no = %s ORDER BY event_date DESC", (patient_no,)))
    patient["documents"] = clean_rows(query_all(
        """SELECT d.id, d.file_name, d.mime_type, d.size_bytes, d.doc_type, d.note, d.created_at,
                  s.full_name AS uploaded_by_name
           FROM documents d LEFT JOIN staff_users s ON s.id = d.uploaded_by
           WHERE d.patient_no = %s ORDER BY d.created_at DESC, d.id DESC""", (patient_no,)))
    return patient


def patient_exists(patient_no):
    return query_one("SELECT 1 AS x FROM patients WHERE patient_no = %s", (patient_no,)) is not None


def _next_patient_no():
    """The next free patient number, e.g. ML-1010."""
    row = query_one("SELECT MAX(CAST(SUBSTRING(patient_no, 4) AS UNSIGNED)) AS n FROM patients")
    return f"ML-{(row['n'] or 1000) + 1}"


def create_patient(data):
    """Save a new patient. data has already passed validators.patient_registration."""
    duplicate = query_one(
        "SELECT patient_no FROM patients WHERE id_type = %s AND id_number = %s AND country = %s",
        (data["id_type"], data["id_number"], data["country"]),
    )
    if duplicate:
        what = "ID number" if data["id_type"] == "SA ID" else "passport"
        raise ApiError(409, f"This {what} is already registered. Log in with the patient number instead.",
                       "id_number")

    # Two people registering at the same moment could get the same number,
    # so try again once if the primary key clashes.
    for attempt in range(2):
        patient_no = _next_patient_no()
        try:
            execute(
                """INSERT INTO patients (patient_no, id_type, id_number, country, date_of_birth,
                       first_name, surname, email, phone, address, password_hash, consent_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
                (patient_no, data["id_type"], data["id_number"], data["country"], data["date_of_birth"],
                 data["first_name"], data["surname"], data["email"], data["phone"], data["address"],
                 generate_password_hash(data["password"])),
            )
            return get_patient(patient_no)
        except pymysql.err.IntegrityError:
            get_db().rollback()
            if attempt == 1:
                raise


def update_patient(patient_no, changes):
    """Update only the fields given. Returns the updated patient."""
    allowed = ("email", "phone", "address", "digitised")
    fields = {k: v for k, v in changes.items() if k in allowed}
    if not fields:
        raise ApiError(400, f"Nothing to update. Send one or more of: {', '.join(allowed)}.")
    set_sql = ", ".join(f"{column} = %s" for column in fields)  # column names come from 'allowed' only
    execute(f"UPDATE patients SET {set_sql} WHERE patient_no = %s", list(fields.values()) + [patient_no])
    return get_patient(patient_no)

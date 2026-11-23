"""
Reset the MediLink database and fill it with realistic demo data.

Run from the project folder with the venv active:
    python seed.py          (asks before wiping anything)
    python seed.py --yes    (skips the question)

It rebuilds every table from schema.sql, so ALL existing data in the database
named by DB_NAME in .env is deleted first. Passwords are hashed with werkzeug.

Demo logins:
    admin / Admin@123     neuro / Neuro@123     ML-1001 to ML-1009 / Patient@123
All people and records are made up.
"""
import os
import sys
from datetime import datetime, timedelta

from werkzeug.security import generate_password_hash

import db  # also loads .env

ROOT = os.path.dirname(os.path.abspath(__file__))

STAFF = [
    ("admin", "admin", "Admin@123", "Practice administrator"),
    ("neuro", "neurologist", "Neuro@123", "Dr Neurologist"),
]

# patient_no, id_type, id_number, country, date_of_birth, first_name, surname,
# email, phone, address, digitised
PATIENTS = [
    ("ML-1001", "SA ID", "6804125254085", "South Africa", "1968-04-12", "Johan", "van Wyk",
     "johan.vanwyk@example.com", "0821234567", "14 Jacaranda Street, Hatfield, Pretoria, 0083", 1),
    ("ML-1002", "SA ID", "7509236766088", "South Africa", "1975-09-23", "Thandi", "Mokoena",
     "thandi.m@example.com", "0739876543", "7 Protea Avenue, Midstream Estate, Centurion, 1692", 1),
    ("ML-1003", "SA ID", "8201170174086", "South Africa", "1982-01-17", "Pieter", "Botha",
     "pbotha@example.com", "0845551234", "22 Lynnwood Road, Lynnwood, Pretoria, 0081", 0),
    ("ML-1004", "SA ID", "5903058196080", "South Africa", "1959-03-05", "Margaret", "Naidoo",
     "m.naidoo@example.com", "0827778888", "3 Oak Lane, Waterkloof, Pretoria, 0145", 1),
    ("ML-1005", "SA ID", "9106285696080", "South Africa", "1991-06-28", "Lerato", "Dlamini",
     "lerato.dlamini@example.com", "0761112222", "18 Burnett Street, Hatfield, Pretoria, 0083", 0),
    ("ML-1006", "SA ID", "4708110619081", "South Africa", "1947-08-11", "Hendrik", "Steyn",
     "hsteyn@example.com", "0823334444", "41 Atterbury Road, Menlo Park, Pretoria, 0081", 0),
    ("ML-1007", "SA ID", "8802143138080", "South Africa", "1988-02-14", "Aisha", "Patel",
     "aisha.patel@example.com", "0715556666", "9 Duncan Street, Brooklyn, Pretoria, 0181", 1),
    ("ML-1008", "SA ID", "6307301544089", "South Africa", "1963-07-30", "Sipho", "Khumalo",
     "sipho.k@example.com", "0839990000", "56 Garsfontein Road, Moreleta Park, Pretoria, 0044", 0),
    ("ML-1009", "Passport", "FN482913", "Zimbabwe", "1986-03-14", "Tendai", "Moyo",
     "tendai.moyo@example.com", "+263771234567", "12 Festival Street, Hatfield, Pretoria, 0083", 0),
]

# patient_no, channel, category, subject, body, urgency, status, admin_note, response,
# hours_ago_created, hours_ago_completed
REQUESTS = [
    ("ML-1006", "Email", "Referral / report request", "Urgent referral letter for neurosurgery",
     "I need a referral letter with my full history by tomorrow morning.", "urgent", "forwarded",
     "Paper file. Needs full history.", None, 3, None),
    ("ML-1002", "Patient portal", "Prescription question", "Repeat script",
     "Can I get a repeat prescription?", "soon", "new", None, None, 5, None),
    ("ML-1005", "Phone", "New symptoms", "Dizziness getting worse",
     "Dizziness now daily and she had a fall yesterday.", "urgent", "new", None, None, 2, None),
    ("ML-1001", "Patient portal", "Follow-up appointment", "Book 6-month follow-up",
     "Mornings work best.", "routine", "new", None, None, 24, None),
    ("ML-1004", "Email", "Referral / report request", "Report for curatorship application",
     "Attorney needs an updated report.", "soon", "forwarded", "Deadline end of next week.", None, 26, None),
    ("ML-1003", "In person", "Prescription question", "Medication side effects",
     "Feeling drowsy since dose change.", "routine", "forwarded", None, None, 30, None),
    ("ML-1007", "Patient portal", "Test results", "EEG results question",
     "What do my sleep EEG results mean?", "routine", "completed", None,
     "Results explained by email.", 48, 24),
    ("ML-1008", "Phone", "Follow-up appointment", "Wife phoned to book follow-up",
     "Next available slot.", "routine", "completed", None, "Booked for Tuesday 10:00.", 72, 71),
    ("ML-1003", "Phone", "Other", "Repeat sick note",
     "Needs a sick note copy.", "routine", "completed", None, "Emailed.", 480, 456),
    ("ML-1006", "In person", "Follow-up appointment", "Tremor review booking",
     "Asked for a tremor review.", "routine", "completed", None, "Booked.", 240, 238),
    ("ML-1009", "Patient portal", "New symptoms", "Numbness in feet",
     "Numbness getting worse.", "soon", "new", None, None, 4, None),
]

# patient_no, event_date, event_type, note
HISTORY = [
    ("ML-1001", "2025-09-10", "Consultation", "Initial assessment for recurring headaches. MRI requested."),
    ("ML-1001", "2026-07-20", "Follow-up", "Migraine frequency down after medication change."),
    ("ML-1002", "2025-11-03", "Consultation", "Review of recurring migraines with aura."),
    ("ML-1003", "2024-05-05", "Consultation", "Long-standing epilepsy patient. On anti-seizure medication."),
    ("ML-1004", "2026-02-18", "EEG", "Routine EEG. No acute abnormality reported."),
    ("ML-1006", "2022-10-01", "Consultation", "Parkinson's disease diagnosed."),
    ("ML-1007", "2026-09-30", "EEG", "Sleep EEG completed."),
    ("ML-1009", "2026-10-20", "Consultation", "Referred by GP for recurring numbness in both feet."),
]


def run_sql_file(cursor, path):
    """Run every statement in a .sql file, skipping comment lines."""
    with open(path, encoding="utf-8") as f:
        lines = [line for line in f.read().splitlines() if not line.strip().startswith("--")]
    for statement in "\n".join(lines).split(";"):
        if statement.strip():
            cursor.execute(statement)


def load_demo_data(cursor):
    now = datetime.now().replace(microsecond=0)

    for username, role, password, full_name in STAFF:
        cursor.execute(
            "INSERT INTO staff_users (username, role, password_hash, full_name) VALUES (%s, %s, %s, %s)",
            (username, role, generate_password_hash(password), full_name))
    cursor.execute("SELECT id FROM staff_users WHERE username = 'admin'")
    admin_id = cursor.fetchone()["id"]

    patient_hash = generate_password_hash("Patient@123")  # same demo password for every patient
    for row in PATIENTS:
        cursor.execute(
            """INSERT INTO patients (patient_no, id_type, id_number, country, date_of_birth, first_name,
                                     surname, email, phone, address, digitised, password_hash, consent_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            row + (patient_hash, now))

    for (patient_no, channel, category, subject, body, urgency, status, admin_note, response,
         hours_created, hours_completed) in REQUESTS:
        created_at = now - timedelta(hours=hours_created)
        completed_at = now - timedelta(hours=hours_completed) if hours_completed is not None else None
        # Email, phone and walk-in requests are typed in by the administrator.
        created_by = None if channel == "Patient portal" else admin_id
        cursor.execute(
            """INSERT INTO requests (patient_no, channel, category, subject, body, urgency, status,
                                     admin_note, response, completed_at, created_by, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (patient_no, channel, category, subject, body, urgency, status, admin_note, response,
             completed_at, created_by, created_at))

    for row in HISTORY:
        cursor.execute(
            "INSERT INTO medical_history (patient_no, event_date, event_type, note) VALUES (%s, %s, %s, %s)",
            row)


def main():
    database = os.getenv("DB_NAME")
    if not database:
        sys.exit("DB_NAME is not set. Check your .env file.")
    if "--yes" not in sys.argv:
        answer = input(f"This DELETES all data in database '{database}' and loads demo data. "
                       "Type yes to continue: ")
        if answer.strip().lower() != "yes":
            sys.exit("Cancelled. Nothing was changed.")

    conn = db.connect()
    try:
        with conn.cursor() as cursor:
            run_sql_file(cursor, os.path.join(ROOT, "schema.sql"))
            load_demo_data(cursor)
        conn.commit()
        with conn.cursor() as cursor:
            for table in ("staff_users", "patients", "requests", "documents", "medical_history"):
                cursor.execute(f"SELECT COUNT(*) AS n FROM {table}")  # table names are fixed above
                print(f"{table:16} {cursor.fetchone()['n']} rows")
        print(f"Database '{database}' is ready.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
"""SQL and file storage for scanned documents."""
import os
import uuid

from werkzeug.utils import secure_filename

from db import execute, get_db, query_one
from models.serialize import clean_row
from routes.errors import ApiError

ALLOWED_TYPES = {
    ".pdf": ("application/pdf", b"%PDF"),
    ".jpg": ("image/jpeg", b"\xff\xd8"),
    ".jpeg": ("image/jpeg", b"\xff\xd8"),
    ".png": ("image/png", b"\x89PNG"),
}
DOC_TYPES = ("Scanned paper record", "Imaging report", "EEG report", "Test report",
             "Referral letter", "Correspondence")


def check_upload(file_storage):
    """Make sure the upload is a real PDF, JPG or PNG. Returns (safe name, extension, mime type)."""
    if file_storage is None or not file_storage.filename:
        raise ApiError(400, "Choose a file to upload.", "file")
    safe_name = secure_filename(file_storage.filename) or "scan"
    ext = os.path.splitext(safe_name)[1].lower()
    if ext not in ALLOWED_TYPES:
        raise ApiError(415, "Only PDF, JPG and PNG files can be uploaded.", "file")
    mime, signature = ALLOWED_TYPES[ext]
    head = file_storage.stream.read(8)
    file_storage.stream.seek(0)
    if not head.startswith(signature):
        raise ApiError(415, f"{file_storage.filename} does not look like a real {ext[1:].upper()} file.", "file")
    return safe_name, ext, mime


def save_document(upload_folder, patient_no, file_storage, doc_type, note, completes_file, uploaded_by):
    """
    Store the file on disk and its details in the database.
    The file is written first. If the database insert fails, the file is
    removed again so disk and database never disagree.
    """
    safe_name, ext, mime = check_upload(file_storage)
    folder = os.path.join(upload_folder, patient_no)
    os.makedirs(folder, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(folder, stored_name)
    file_storage.save(full_path)
    size = os.path.getsize(full_path)

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO documents (patient_no, file_name, stored_path, mime_type, size_bytes,
                       doc_type, note, uploaded_by) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (patient_no, safe_name, f"{patient_no}/{stored_name}", mime, size, doc_type, note, uploaded_by),
            )
            new_id = cur.lastrowid
            if completes_file:
                cur.execute("UPDATE patients SET digitised = TRUE WHERE patient_no = %s", (patient_no,))
        conn.commit()  # both changes are saved together, or neither is
    except Exception:
        conn.rollback()
        os.remove(full_path)
        raise
    return get_document(new_id)


def get_document(doc_id):
    return clean_row(query_one(
        """SELECT id, patient_no, file_name, stored_path, mime_type, size_bytes, doc_type, note,
                  uploaded_by, created_at FROM documents WHERE id = %s""", (doc_id,)))


def delete_document(upload_folder, doc_id):
    doc = get_document(doc_id)
    if doc is None:
        raise ApiError(404, "Document not found.")
    execute("DELETE FROM documents WHERE id = %s", (doc_id,))
    path = os.path.join(upload_folder, doc["stored_path"])
    if os.path.exists(path):
        os.remove(path)
    return doc

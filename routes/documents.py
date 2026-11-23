"""Document endpoints: upload, open or download, and delete scanned files."""
import os

from flask import Blueprint, current_app, jsonify, request, send_file

from models import documents, patients
from routes.errors import ApiError
from routes.helpers import STAFF_ROLES, current_user, login_required

documents_bp = Blueprint("documents", __name__)


@documents_bp.post("/patients/<patient_no>/documents")
@login_required(*STAFF_ROLES)
def upload_document(patient_no):
    """POST /api/patients/<patient_no>/documents  (multipart form: file, doc_type, note, completes_file)"""
    patient_no = patient_no.upper()
    if not patients.patient_exists(patient_no):
        raise ApiError(404, f"No patient with number {patient_no}.")
    doc_type = request.form.get("doc_type") or "Scanned paper record"
    if doc_type not in documents.DOC_TYPES:
        raise ApiError(400, f"Document type must be one of: {', '.join(documents.DOC_TYPES)}.", "doc_type")
    note = (request.form.get("note") or "").strip()[:120] or None
    completes_file = request.form.get("completes_file", "false").lower() == "true"

    doc = documents.save_document(
        current_app.config["UPLOAD_FOLDER"], patient_no, request.files.get("file"),
        doc_type, note, completes_file, current_user().get("staff_id"))
    current_app.logger.info("Document %s uploaded for %s (%s bytes)", doc["id"], patient_no, doc["size_bytes"])
    return jsonify({"document": doc, "patient_digitised": completes_file or None}), 201


@documents_bp.get("/documents/<int:doc_id>/file")
@login_required(*STAFF_ROLES)
def download_document(doc_id):
    """GET /api/documents/<id>/file  (add ?download=1 to download instead of open)"""
    doc = documents.get_document(doc_id)
    if doc is None:
        raise ApiError(404, "Document not found.")
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], doc["stored_path"])
    if not os.path.exists(path):
        current_app.logger.error("File missing on disk for document %s: %s", doc_id, path)
        raise ApiError(404, "The file is missing from the server.")
    return send_file(path, mimetype=doc["mime_type"], download_name=doc["file_name"],
                     as_attachment=request.args.get("download") == "1")


@documents_bp.delete("/documents/<int:doc_id>")
@login_required(*STAFF_ROLES)
def delete_document(doc_id):
    """DELETE /api/documents/<id>"""
    doc = documents.delete_document(current_app.config["UPLOAD_FOLDER"], doc_id)
    current_app.logger.info("Document %s deleted by %s", doc_id, current_user()["username"])
    return jsonify({"message": "Document deleted.", "document": doc})

"""Patient endpoints: list, read, register and update."""
from flask import Blueprint, current_app, jsonify, request

from models import patients, patient_requests, validators
from routes.errors import ApiError
from routes.helpers import (STAFF_ROLES, choice_arg, current_user, json_body, login_required,
                            page_args, paged, require_staff_or_patient)

patients_bp = Blueprint("patients", __name__)


@patients_bp.get("")
@login_required(*STAFF_ROLES)
def list_patients():
    """GET /api/patients?search=&digitised=true|false&page=&size="""
    page, size = page_args()
    search = (request.args.get("search") or "").strip()[:60] or None
    digitised = choice_arg("digitised", ("true", "false"))
    items, total = patients.list_patients(
        search=search, digitised=None if digitised is None else digitised == "true", page=page, size=size)
    return paged(items, total, page, size)


@patients_bp.get("/<patient_no>")
def get_patient(patient_no):
    """GET /api/patients/<patient_no>  (staff, or the patient themself)"""
    patient_no = patient_no.upper()
    require_staff_or_patient(patient_no)
    patient = patients.get_patient(patient_no)
    if patient is None:
        raise ApiError(404, f"No patient with number {patient_no}.")
    return jsonify({"patient": patient})


@patients_bp.post("")
def register_patient():
    """POST /api/patients  (a new patient, or staff registering one at reception)"""
    user = current_user()
    if user and user["role"] == "patient":
        raise ApiError(403, "You are already registered. Log out first to register someone else.")
    data = validators.patient_registration(json_body())
    patient = patients.create_patient(data)
    current_app.logger.info("Patient registered: %s by %s", patient["patient_no"],
                            user["username"] if user else "self-registration")
    return jsonify({"patient": patient}), 201


@patients_bp.patch("/<patient_no>")
@login_required(*STAFF_ROLES)
def update_patient(patient_no):
    """PATCH /api/patients/<patient_no>  {email, phone, address, digitised}"""
    patient_no = patient_no.upper()
    if not patients.patient_exists(patient_no):
        raise ApiError(404, f"No patient with number {patient_no}.")
    data = json_body()
    changes = {}
    if "email" in data:
        changes["email"] = validators.email(data)
    if "phone" in data:
        changes["phone"] = validators.phone(data)
    if "address" in data:
        changes["address"] = validators.text(data, "address", "Address", 255)
    if "digitised" in data:
        if not isinstance(data["digitised"], bool):
            raise ApiError(400, "digitised must be true or false.", "digitised")
        changes["digitised"] = data["digitised"]
    patient = patients.update_patient(patient_no, changes)
    current_app.logger.info("Patient %s updated: %s", patient_no, ", ".join(changes))
    return jsonify({"patient": patient})


@patients_bp.get("/<patient_no>/requests")
def patient_request_list(patient_no):
    """GET /api/patients/<patient_no>/requests  (staff, or the patient themself)"""
    patient_no = patient_no.upper()
    require_staff_or_patient(patient_no)
    if not patients.patient_exists(patient_no):
        raise ApiError(404, f"No patient with number {patient_no}.")
    page, size = page_args()
    items, total = patient_requests.list_requests(patient_no=patient_no, page=page, size=size)
    return paged(items, total, page, size)

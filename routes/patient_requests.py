"""Request endpoints: the queue that admin and the neurologist work from."""
from flask import Blueprint, current_app, jsonify, request

from models import patient_requests, patients, validators
from routes.errors import ApiError
from routes.helpers import (STAFF_ROLES, choice_arg, current_user, json_body, login_required,
                            page_args, paged, require_staff_or_patient)

requests_bp = Blueprint("patient_requests", __name__)


@requests_bp.get("")
@login_required(*STAFF_ROLES)
def list_requests():
    """GET /api/requests?status=&urgency=&channel=&search=&sort=&page=&size="""
    page, size = page_args()
    items, total = patient_requests.list_requests(
        status=choice_arg("status", validators.STATUSES),
        urgency=choice_arg("urgency", validators.URGENCIES),
        channel=choice_arg("channel", validators.CHANNELS),
        search=(request.args.get("search") or "").strip()[:60] or None,
        sort=choice_arg("sort", ("created_at", "urgency")) or "created_at",
        page=page, size=size,
    )
    return paged(items, total, page, size)


@requests_bp.get("/<int:request_id>")
@login_required()
def get_request(request_id):
    """GET /api/requests/<id>  (staff, or the patient it belongs to)"""
    item = patient_requests.get_request(request_id)
    if item is None:
        raise ApiError(404, "Request not found.")
    require_staff_or_patient(item["patient_no"])
    return jsonify({"request": item})


@requests_bp.post("")
@login_required()
def create_request():
    """POST /api/requests  (a patient for themself, or staff for any patient)"""
    user = current_user()
    data = validators.new_request(json_body())
    data["patient_no"] = data["patient_no"].upper()
    require_staff_or_patient(data["patient_no"])
    if user["role"] == "patient":
        data["channel"] = "Patient portal"  # patients can only use the portal
    if not patients.patient_exists(data["patient_no"]):
        raise ApiError(404, f"No patient with number {data['patient_no']}.", "patient_no")
    item = patient_requests.create_request(data, created_by=user.get("staff_id"))
    current_app.logger.info("Request %s created for %s by %s", item["id"], item["patient_no"], user["username"])
    return jsonify({"request": item}), 201


@requests_bp.patch("/<int:request_id>")
@login_required(*STAFF_ROLES)
def update_request(request_id):
    """PATCH /api/requests/<id>  {status, urgency, admin_note, response}"""
    data = json_body()
    changes = {}
    if "status" in data:
        changes["status"] = validators.one_of(data, "status", "Status", validators.STATUSES)
    if "urgency" in data:
        changes["urgency"] = validators.one_of(data, "urgency", "Urgency", validators.URGENCIES)
    if "admin_note" in data:
        changes["admin_note"] = validators.text(data, "admin_note", "Admin note", 300, required=False)
    if "response" in data:
        changes["response"] = validators.text(data, "response", "Reply", 2000, required=False)
    item = patient_requests.update_request(request_id, changes)
    current_app.logger.info("Request %s updated by %s: %s", request_id, current_user()["username"],
                            ", ".join(f"{k}={v}" for k, v in changes.items() if k in ("status", "urgency")))
    return jsonify({"request": item})

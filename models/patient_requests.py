"""SQL and business rules for patient requests (the request queue)."""
from db import execute, query_all, query_one
from models.serialize import clean_row
from routes.errors import ApiError

# A request can only move forward: new -> forwarded -> completed (or new -> completed).
ALLOWED_STATUS_CHANGES = {
    "new": ("new", "forwarded", "completed"),
    "forwarded": ("forwarded", "completed"),
    "completed": ("completed",),
}

REQUEST_SELECT = """
    SELECT r.id, r.patient_no, CONCAT(p.first_name, ' ', p.surname) AS patient_name,
           p.digitised, r.channel, r.category, r.subject, r.body, r.urgency, r.status,
           r.admin_note, r.response, r.completed_at, r.created_by, r.created_at, r.updated_at
    FROM requests r JOIN patients p ON p.patient_no = r.patient_no
"""

SORT_OPTIONS = {
    "created_at": "r.created_at DESC",
    "urgency": "FIELD(r.urgency, 'urgent', 'soon', 'routine'), r.created_at ASC",
}


def _clean(row):
    out = clean_row(row)
    if out is not None:
        out["digitised"] = bool(out["digitised"])
    return out


def list_requests(status=None, urgency=None, channel=None, patient_no=None, search=None,
                  sort="created_at", page=1, size=20):
    """One page of requests, filtered and sorted."""
    where, params = [], []
    for column, value in (("r.status", status), ("r.urgency", urgency),
                          ("r.channel", channel), ("r.patient_no", patient_no)):
        if value:
            where.append(f"{column} = %s")
            params.append(value)
    if search:
        like = f"%{search}%"
        where.append("(r.subject LIKE %s OR r.patient_no LIKE %s OR CONCAT(p.first_name, ' ', p.surname) LIKE %s)")
        params += [like, like, like]
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    total = query_one(
        f"SELECT COUNT(*) AS n FROM requests r JOIN patients p ON p.patient_no = r.patient_no {where_sql}",
        params)["n"]
    rows = query_all(
        f"{REQUEST_SELECT} {where_sql} ORDER BY {SORT_OPTIONS[sort]} LIMIT %s OFFSET %s",
        params + [size, (page - 1) * size],
    )
    return [_clean(r) for r in rows], total


def get_request(request_id):
    return _clean(query_one(f"{REQUEST_SELECT} WHERE r.id = %s", (request_id,)))


def create_request(data, created_by=None):
    """Save a new request. data has already passed validators.new_request."""
    new_id = execute(
        """INSERT INTO requests (patient_no, channel, category, subject, body, urgency, status, created_by)
           VALUES (%s, %s, %s, %s, %s, %s, 'new', %s)""",
        (data["patient_no"], data["channel"], data["category"], data["subject"], data["body"],
         data["urgency"], created_by),
    )
    return get_request(new_id)


def update_request(request_id, changes):
    """Change status, urgency, admin note or reply. Enforces the status rules."""
    current = get_request(request_id)
    if current is None:
        raise ApiError(404, "Request not found.")

    new_status = changes.get("status", current["status"])
    if new_status not in ALLOWED_STATUS_CHANGES[current["status"]]:
        raise ApiError(400, f"A {current['status']} request cannot be moved back to {new_status}.", "status")
    if new_status == "completed" and current["status"] != "completed" and not (
            changes.get("response") or current["response"]):
        raise ApiError(400, "Add a reply or outcome before completing the request.", "response")

    fields = {k: changes[k] for k in ("status", "urgency", "admin_note", "response") if k in changes}
    if not fields:
        raise ApiError(400, "Nothing to update. Send status, urgency, admin_note or response.")
    set_sql = ", ".join(f"{column} = %s" for column in fields)  # names come from the fixed list above
    params = list(fields.values())
    if new_status == "completed" and current["status"] != "completed":
        set_sql += ", completed_at = NOW()"
    execute(f"UPDATE requests SET {set_sql} WHERE id = %s", params + [request_id])
    return get_request(request_id)

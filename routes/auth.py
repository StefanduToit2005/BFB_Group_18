"""Login, logout and who-am-I endpoints."""
from flask import Blueprint, current_app, jsonify, session

from models import users
from routes.errors import ApiError
from routes.helpers import current_user, json_body, login_required

auth_bp = Blueprint("auth", __name__)

ROLES = ("patient", "admin", "neurologist")


@auth_bp.post("/login")
def login():
    """POST /api/auth/login  {role, username, password}"""
    data = json_body()
    role, username, password = data.get("role"), str(data.get("username") or "").strip(), data.get("password")
    if role not in ROLES:
        raise ApiError(400, "Choose a role: patient, admin or neurologist.", "role")
    if not username or not password:
        raise ApiError(400, "Enter your username and password.", "username")

    if role == "patient":
        patient = users.check_patient_login(username.upper(), password)
        if not patient:
            raise ApiError(401, "Incorrect username or password.")
        user = {"role": "patient", "username": patient["patient_no"], "patient_no": patient["patient_no"],
                "name": f"{patient['first_name']} {patient['surname']}"}
    else:
        staff = users.check_staff_login(username.lower(), password)
        if not staff:
            raise ApiError(401, "Incorrect username or password.")
        if staff["role"] != role:
            raise ApiError(403, f"This is not {'an admin' if role == 'admin' else 'a neurologist'} account. "
                                "Go back and choose the right role.")
        user = {"role": staff["role"], "username": staff["username"], "name": staff["full_name"],
                "staff_id": staff["id"]}

    session.clear()
    session["user"] = user
    current_app.logger.info("Login: %s (%s)", user["username"], user["role"])
    return jsonify({"user": user})


@auth_bp.post("/logout")
@login_required()
def logout():
    """POST /api/auth/logout"""
    current_app.logger.info("Logout: %s", current_user()["username"])
    session.clear()
    return jsonify({"message": "Logged out."})


@auth_bp.get("/me")
@login_required()
def me():
    """GET /api/auth/me"""
    return jsonify({"user": current_user()})

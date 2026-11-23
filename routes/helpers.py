"""Small helpers shared by all the API blueprints."""
from functools import wraps

from flask import jsonify, request, session

from routes.errors import ApiError

STAFF_ROLES = ("admin", "neurologist")


def current_user():
    """The logged-in user saved in the session, or None."""
    return session.get("user")


def login_required(*roles):
    """
    Protect an endpoint. With no roles, any logged-in user may call it.
    Example:  @login_required("admin", "neurologist")
    """
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                raise ApiError(401, "Please log in first.")
            if roles and user["role"] not in roles:
                raise ApiError(403, "You don't have access to this.")
            return view(*args, **kwargs)
        return wrapper
    return decorator


def require_staff_or_patient(patient_no):
    """Staff can see any patient. A patient can only see their own record."""
    user = current_user()
    if not user:
        raise ApiError(401, "Please log in first.")
    if user["role"] in STAFF_ROLES:
        return user
    if user["role"] == "patient" and user.get("patient_no") == patient_no:
        return user
    raise ApiError(403, "You can only view your own record.")


def json_body():
    """The request body as a dictionary. Refuses anything that isn't a JSON object."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError(400, "Send the data as a JSON object.")
    return data


def int_arg(name, default, minimum, maximum):
    """Read a whole-number query parameter and check its range."""
    raw = request.args.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ApiError(400, f"'{name}' must be a whole number.", name)
    if not minimum <= value <= maximum:
        raise ApiError(400, f"'{name}' must be between {minimum} and {maximum}.", name)
    return value


def float_arg(name, default, minimum, maximum):
    """Read a decimal query parameter and check its range."""
    raw = request.args.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = float(raw)
    except ValueError:
        raise ApiError(400, f"'{name}' must be a number.", name)
    if not minimum <= value <= maximum:
        raise ApiError(400, f"'{name}' must be between {minimum} and {maximum}.", name)
    return value


def choice_arg(name, allowed):
    """Read an optional query parameter that must be one of a fixed list."""
    value = request.args.get(name)
    if value in (None, ""):
        return None
    if value not in allowed:
        raise ApiError(400, f"'{name}' must be one of: {', '.join(allowed)}.", name)
    return value


def page_args():
    """page (from 1) and size (1 to 100) for any list endpoint."""
    return int_arg("page", 1, 1, 100_000), int_arg("size", 20, 1, 100)


def paged(items, total, page, size):
    """Standard list response: items plus page information."""
    pages = (total + size - 1) // size if total else 0
    return jsonify({"items": items, "page": page, "size": size, "total": total, "pages": pages})

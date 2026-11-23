"""
Input checks for patients and requests.
Each check raises ApiError(400, message, field) so the front end can
show the message under the right field.
"""
import re
from datetime import date

from routes.errors import ApiError

ID_TYPES = ("SA ID", "Passport")
CHANNELS = ("Patient portal", "Email", "Phone", "In person")
CATEGORIES = ("Follow-up appointment", "New symptoms", "Prescription question",
              "Test results", "Referral / report request", "Other")
URGENCIES = ("urgent", "soon", "routine")
STATUSES = ("new", "forwarded", "completed")


def text(data, field, label, max_len, required=True, min_len=1):
    """A trimmed piece of text with a length limit."""
    value = data.get(field)
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ApiError(400, f"{label} is required.", field)
        return None
    if not isinstance(value, str):
        raise ApiError(400, f"{label} must be text.", field)
    value = value.strip()
    if len(value) < min_len:
        raise ApiError(400, f"{label} must be at least {min_len} characters.", field)
    if len(value) > max_len:
        raise ApiError(400, f"{label} must be {max_len} characters or fewer.", field)
    return value


def one_of(data, field, label, allowed, required=True):
    value = data.get(field)
    if value in (None, ""):
        if required:
            raise ApiError(400, f"{label} is required.", field)
        return None
    if value not in allowed:
        raise ApiError(400, f"{label} must be one of: {', '.join(allowed)}.", field)
    return value


def valid_sa_id(id_number):
    """13 digits, a real month and day, and a correct Luhn check digit."""
    if not re.fullmatch(r"\d{13}", id_number):
        return False
    month, day = int(id_number[2:4]), int(id_number[4:6])
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return False
    total = 0
    for i, ch in enumerate(reversed(id_number)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def dob_from_sa_id(id_number):
    """The date of birth stored in the first six digits of an SA ID."""
    yy, mm, dd = int(id_number[:2]), int(id_number[2:4]), int(id_number[4:6])
    year = (1900 if yy > date.today().year % 100 else 2000) + yy
    return date(year, mm, dd)


def phone(data, field="phone", required=True):
    """SA number (0 and 9 digits) or international (+ and 8 to 15 digits)."""
    value = text(data, field, "Phone number", 20, required)
    if value is None:
        return None
    value = re.sub(r"[\s()-]", "", value)
    if not (re.fullmatch(r"0\d{9}", value) or re.fullmatch(r"\+\d{8,15}", value)):
        raise ApiError(400, "Phone number must be 10 digits starting with 0, or start with +.", field)
    return value


def email(data, field="email", required=True):
    value = text(data, field, "Email", 120, required)
    if value is None:
        return None
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]{2,}", value):
        raise ApiError(400, "Please enter a valid email address.", field)
    return value.lower()


def password(data, field="password"):
    value = data.get(field)
    if not isinstance(value, str) or len(value) < 8 or not re.search(r"[A-Za-z]", value) \
            or not re.search(r"\d", value):
        raise ApiError(400, "Password must be at least 8 characters, with a letter and a number.", field)
    return value


def patient_registration(data):
    """Check a new patient's details and return a clean dictionary."""
    clean = {
        "first_name": text(data, "first_name", "First name", 60),
        "surname": text(data, "surname", "Surname", 60),
        "email": email(data),
        "phone": phone(data),
        "address": text(data, "address", "Address", 255),
        "id_type": one_of(data, "id_type", "ID type", ID_TYPES),
        "password": password(data),
    }
    if data.get("consent") is not True:
        raise ApiError(400, "The patient must agree to digital storage (POPI Act).", "consent")

    raw_id = text(data, "id_number", "ID or passport number", 20)
    if clean["id_type"] == "SA ID":
        if not valid_sa_id(raw_id):
            raise ApiError(400, "That SA ID number is not valid. Check all 13 digits.", "id_number")
        clean["id_number"] = raw_id
        clean["country"] = "South Africa"
        clean["date_of_birth"] = dob_from_sa_id(raw_id)
    else:
        passport_no = re.sub(r"[^A-Za-z0-9]", "", raw_id).upper()
        if not 6 <= len(passport_no) <= 20:
            raise ApiError(400, "Passport number must be 6 to 20 letters and numbers.", "id_number")
        clean["id_number"] = passport_no
        clean["country"] = text(data, "country", "Country of issue", 60)
        clean["date_of_birth"] = date_value(data, "date_of_birth", "Date of birth")
    return clean


def date_value(data, field, label):
    value = data.get(field)
    try:
        parsed = date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ApiError(400, f"{label} must be a date like 1990-05-20.", field)
    if not date(1900, 1, 1) <= parsed <= date.today():
        raise ApiError(400, f"{label} must be between 1900 and today.", field)
    return parsed


def new_request(data):
    """Check a new patient request and return a clean dictionary."""
    return {
        "patient_no": text(data, "patient_no", "Patient number", 10),
        "channel": one_of(data, "channel", "Channel", CHANNELS, required=False) or "Patient portal",
        "category": one_of(data, "category", "Category", CATEGORIES),
        "subject": text(data, "subject", "Subject", 80),
        "body": text(data, "body", "Message", 1000, min_len=5),
        "urgency": one_of(data, "urgency", "Urgency", URGENCIES, required=False) or "routine",
    }

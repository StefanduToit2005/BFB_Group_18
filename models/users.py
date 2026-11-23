"""Looking up accounts for login."""
from werkzeug.security import check_password_hash

from db import query_one


def check_staff_login(username, password):
    """The staff account if the username and password match, otherwise None."""
    user = query_one(
        "SELECT id, username, password_hash, role, full_name FROM staff_users WHERE username = %s",
        (username,),
    )
    if user and check_password_hash(user["password_hash"], password):
        return user
    return None


def check_patient_login(patient_no, password):
    """The patient if the patient number and password match, otherwise None."""
    patient = query_one(
        "SELECT patient_no, first_name, surname, password_hash FROM patients WHERE patient_no = %s",
        (patient_no,),
    )
    if patient and check_password_hash(patient["password_hash"], password):
        return patient
    return None

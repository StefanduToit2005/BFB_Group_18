"""Patient endpoints: list with paging and filters, read, register and update."""
import db

NEW_PATIENT = {
    "first_name": "Farai", "surname": "Ncube", "id_type": "Passport", "id_number": "fn 99-1234",
    "country": "Zimbabwe", "date_of_birth": "1990-05-20", "phone": "+263 77 555 1234",
    "email": "Farai@Example.com", "address": "3 Park St, Pretoria, 0083",
    "password": "Farai2026", "consent": True,
}


def test_list_is_paged(client, login):
    login("admin")
    body = client.get("/api/patients?page=2&size=4").get_json()
    assert body["page"] == 2 and body["size"] == 4 and len(body["items"]) == 4
    assert body["total"] == 9 and body["pages"] == 3


def test_list_filters_by_search_and_digitised(client, login):
    login("admin")
    assert [p["patient_no"] for p in client.get("/api/patients?search=botha").get_json()["items"]] == ["ML-1003"]
    paper = client.get("/api/patients?digitised=false").get_json()["items"]
    assert paper and all(not p["digitised"] for p in paper)


def test_bad_paging_values_give_400(client, login):
    login("admin")
    for query in ("page=0", "size=500", "page=abc", "digitised=maybe"):
        r = client.get(f"/api/patients?{query}")
        assert r.status_code == 400, query
        assert "error" in r.get_json()


def test_register_passport_patient_and_log_in(client):
    r = client.post("/api/patients", json=NEW_PATIENT)
    assert r.status_code == 201, r.get_json()
    patient = r.get_json()["patient"]
    assert patient["patient_no"] == "ML-1010"
    assert patient["id_number"] == "FN991234" and patient["phone"] == "+263775551234"
    assert patient["email"] == "farai@example.com"
    login = client.post("/api/auth/login", json={"role": "patient", "username": "ml-1010", "password": "Farai2026"})
    assert login.status_code == 200


def test_register_sa_id_works_out_date_of_birth(client):
    data = {**NEW_PATIENT, "id_type": "SA ID", "id_number": "9001015009086", "country": None}
    patient = client.post("/api/patients", json=data).get_json()["patient"]
    assert patient["date_of_birth"] == "1990-01-01" and patient["country"] == "South Africa"


def test_duplicate_document_gives_409(client):
    assert client.post("/api/patients", json=NEW_PATIENT).status_code == 201
    r = client.post("/api/patients", json={**NEW_PATIENT, "email": "other@example.com"})
    assert r.status_code == 409 and r.get_json()["error"]["field"] == "id_number"


def test_registration_validation(client):
    cases = {
        "id_number": {**NEW_PATIENT, "id_type": "SA ID", "id_number": "1234567890123"},
        "phone": {**NEW_PATIENT, "phone": "12345"},
        "password": {**NEW_PATIENT, "password": "short"},
        "consent": {**NEW_PATIENT, "consent": False},
        "first_name": {k: v for k, v in NEW_PATIENT.items() if k != "first_name"},
    }
    for field, data in cases.items():
        r = client.post("/api/patients", json=data)
        assert r.status_code == 400, field
        assert r.get_json()["error"]["field"] == field


def test_patient_sees_only_own_record(client, login):
    login("patient")
    assert client.get("/api/patients/ML-1001").status_code == 200
    assert client.get("/api/patients/ML-1002").status_code == 403
    assert client.get("/api/patients").status_code == 403


def test_update_patient_saves_to_mysql(client, login, app):
    login("admin")
    r = client.patch("/api/patients/ML-1003", json={"phone": "082 000 1111", "digitised": True})
    assert r.status_code == 200
    with app.app_context():
        row = db.query_one("SELECT phone, digitised FROM patients WHERE patient_no = %s", ("ML-1003",))
    assert row["phone"] == "0820001111" and row["digitised"] == 1


def test_update_rejects_bad_input(client, login):
    login("admin")
    assert client.patch("/api/patients/ML-1003", json={"email": "not-an-email"}).status_code == 400
    assert client.patch("/api/patients/ML-1003", json={"name": "x"}).status_code == 400
    assert client.patch("/api/patients/ML-9999", json={"phone": "0821234567"}).status_code == 404

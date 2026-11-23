"""The main flow: patient sends a request, admin forwards it, neurologist completes it."""
import db

NEW_REQUEST = {"patient_no": "ML-1001", "category": "New symptoms", "subject": "Headaches every morning",
               "body": "Started a week ago.", "urgency": "urgent", "channel": "Phone"}


def test_full_request_flow(client, login, app):
    # 1. Patient sends a request. Their channel is always the portal.
    login("patient")
    r = client.post("/api/requests", json=NEW_REQUEST)
    assert r.status_code == 201
    req = r.get_json()["request"]
    assert req["status"] == "new" and req["channel"] == "Patient portal"
    client.post("/api/auth/logout")

    # 2. Admin sees it at the top of the new, urgent queue and forwards it with a note.
    login("admin")
    queue = client.get("/api/requests?status=new&sort=urgency").get_json()["items"]
    assert req["id"] in [q["id"] for q in queue]
    r = client.patch(f"/api/requests/{req['id']}", json={"status": "forwarded", "admin_note": "New symptoms"})
    assert r.get_json()["request"]["status"] == "forwarded"
    client.post("/api/auth/logout")

    # 3. Neurologist completes it with a reply.
    login("neurologist")
    r = client.patch(f"/api/requests/{req['id']}", json={"status": "completed", "response": "Come in on Monday."})
    done = r.get_json()["request"]
    assert done["status"] == "completed" and done["completed_at"] is not None
    client.post("/api/auth/logout")

    # 4. The patient sees the reply, and it is saved in MySQL.
    login("patient")
    mine = client.get("/api/patients/ML-1001/requests").get_json()["items"]
    assert any(m["response"] == "Come in on Monday." for m in mine)
    with app.app_context():
        assert db.query_one("SELECT status FROM requests WHERE id = %s", (req["id"],))["status"] == "completed"


def test_staff_logs_phone_request_for_patient(client, login):
    login("admin")
    req = client.post("/api/requests", json={**NEW_REQUEST, "patient_no": "ml-1003"}).get_json()["request"]
    assert req["channel"] == "Phone" and req["patient_no"] == "ML-1003"


def test_patient_cannot_send_for_someone_else(client, login):
    login("patient")
    assert client.post("/api/requests", json={**NEW_REQUEST, "patient_no": "ML-1002"}).status_code == 403


def test_status_cannot_go_backwards(client, login):
    login("admin")
    completed = client.get("/api/requests?status=completed").get_json()["items"][0]
    r = client.patch(f"/api/requests/{completed['id']}", json={"status": "new"})
    assert r.status_code == 400 and r.get_json()["error"]["field"] == "status"


def test_complete_needs_a_reply(client, login):
    login("neurologist")
    new = client.get("/api/requests?status=new").get_json()["items"][0]
    assert client.patch(f"/api/requests/{new['id']}", json={"status": "completed"}).status_code == 400


def test_queue_filters_and_validation(client, login):
    login("admin")
    urgent = client.get("/api/requests?urgency=urgent").get_json()["items"]
    assert urgent and all(r["urgency"] == "urgent" for r in urgent)
    phone = client.get("/api/requests?channel=Phone").get_json()["items"]
    assert phone and all(r["channel"] == "Phone" for r in phone)
    assert client.get("/api/requests?status=lost").status_code == 400
    assert client.get("/api/requests?sort=name").status_code == 400
    assert client.post("/api/requests", json={**NEW_REQUEST, "category": "Gossip"}).status_code == 400
    assert client.get("/api/requests/999999").status_code == 404

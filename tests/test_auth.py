"""Login, logout and role checks."""


def test_login_each_role(client, login):
    for role in ("patient", "admin", "neurologist"):
        login(role)
        me = client.get("/api/auth/me").get_json()["user"]
        assert me["role"] == role
        client.post("/api/auth/logout")


def test_wrong_password_is_refused(client):
    r = client.post("/api/auth/login", json={"role": "admin", "username": "admin", "password": "wrong"})
    assert r.status_code == 401
    assert r.get_json()["error"]["message"] == "Incorrect username or password."


def test_admin_cannot_log_in_as_neurologist(client):
    r = client.post("/api/auth/login", json={"role": "neurologist", "username": "admin", "password": "Admin@123"})
    assert r.status_code == 403


def test_logged_out_user_is_refused(client):
    assert client.get("/api/requests").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_password_hash_never_returned(client, login):
    login("admin")
    body = client.get("/api/patients/ML-1001").get_data(as_text=True)
    assert "password_hash" not in body

"""Central error handling: clean JSON errors, no stack traces, rollback after failed writes."""
import db


def test_unknown_address_gives_json_404(client):
    r = client.get("/api/nothing-here")
    assert r.status_code == 404 and r.get_json()["error"]["code"] == 404


def test_wrong_method_gives_json_405(client):
    assert client.delete("/api/patients").status_code == 405


def test_non_json_body_gives_400(client):
    r = client.post("/api/auth/login", data="hello", content_type="text/plain")
    assert r.status_code == 400 and "JSON" in r.get_json()["error"]["message"]


def test_unexpected_error_is_hidden_and_logged(client, login, monkeypatch, caplog):
    login("admin")
    from models import stats

    def broken():
        raise RuntimeError("secret internal detail")
    monkeypatch.setattr(stats, "live_counts", broken)
    r = client.get("/api/kpis/live")
    assert r.status_code == 500
    assert "secret internal detail" not in r.get_data(as_text=True)
    assert "unexpected error" in caplog.text


def test_failed_write_is_rolled_back(client, login, app, monkeypatch):
    """If a write crashes before it is committed, the change must be undone."""
    import io
    from models import documents
    login("admin")

    def change_then_crash(*args, **kwargs):
        with db.get_db().cursor() as cur:
            cur.execute("UPDATE patients SET digitised = TRUE WHERE patient_no = 'ML-1003'")
        raise RuntimeError("crash before commit")

    monkeypatch.setattr(documents, "save_document", change_then_crash)
    r = client.post("/api/patients/ML-1003/documents", content_type="multipart/form-data",
                    data={"file": (io.BytesIO(b"%PDF-1.4"), "x.pdf")})
    assert r.status_code == 500
    with app.app_context():
        assert db.query_one("SELECT digitised FROM patients WHERE patient_no = 'ML-1003'")["digitised"] == 0

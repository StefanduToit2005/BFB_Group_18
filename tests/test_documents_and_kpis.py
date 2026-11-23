"""Scanning in a paper file, and the KPIs that change because of it (the model-driven flow)."""
import io

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def upload(client, data=PDF, name="Botha_CamScanner.pdf", completes="true"):
    return client.post("/api/patients/ML-1003/documents", content_type="multipart/form-data", data={
        "file": (io.BytesIO(data), name), "doc_type": "Scanned paper record",
        "note": "Full binder", "completes_file": completes})


def test_scanning_a_file_changes_the_model_kpis(client, login):
    login("neurologist")
    before = client.get("/api/kpis/retrieval").get_json()
    assert before["digitised_share_source"] == "database"

    r = upload(client)
    assert r.status_code == 201
    doc = r.get_json()["document"]

    # The file can be downloaded again byte for byte.
    file = client.get(f"/api/documents/{doc['id']}/file?download=1")
    assert file.status_code == 200 and file.data == PDF

    # The patient is now digitised, so the model shows a bigger saving.
    patient = client.get("/api/patients/ML-1003").get_json()["patient"]
    assert patient["digitised"] is True and patient["documents"][0]["file_name"] == "Botha_CamScanner.pdf"
    assert patient["documents"][0]["uploaded_by_name"] == "Dr Neurologist"
    after = client.get("/api/kpis/retrieval").get_json()
    assert after["inputs"]["digitised_share"] > before["inputs"]["digitised_share"]
    assert after["savings"]["per_month"] > before["savings"]["per_month"]


def test_retrieval_model_matches_baseline(client, login):
    login("neurologist")
    k = client.get("/api/kpis/retrieval?digitised_share=0").get_json()
    assert k["before"]["wasted_hours_per_day"] == 1.65
    assert k["before"]["monthly_cost"] == 2831.4
    assert k["before"]["yearly_cost"] == 33976.8
    assert k["before"]["avg_retrieval_minutes"] == 9.5
    assert k["before"]["total_retrieval_hours_per_day"] == round(22 * 9.5 / 60, 2)
    full = client.get("/api/kpis/retrieval?digitised_share=1").get_json()
    assert full["after"]["monthly_cost"] == 0 and full["savings"]["per_month"] == 2831.4
    assert full["savings"]["retrieval_time_cut_pct"] == round((1 - 1 / 9.5) * 100, 1)


def test_kpi_inputs_are_validated(client, login):
    login("neurologist")
    assert client.get("/api/kpis/retrieval?delay_rate=2").status_code == 400
    assert client.get("/api/kpis/retrieval?hourly_rate=abc").status_code == 400


def test_only_neurologist_sees_cost_model(client, login):
    login("admin")
    assert client.get("/api/kpis/retrieval").status_code == 403
    assert client.get("/api/kpis/live").status_code == 200


def test_live_counts_change_with_data(client, login):
    login("admin")
    before = client.get("/api/kpis/live").get_json()
    client.post("/api/requests", json={"patient_no": "ML-1002", "category": "Other", "subject": "Parking",
                                       "body": "Asked about parking.", "channel": "Phone"})
    after = client.get("/api/kpis/live").get_json()
    assert after["requests"]["new"] == before["requests"]["new"] + 1


def test_digitise_priority_lists_paper_files_only(client, login):
    login("admin")
    items = client.get("/api/kpis/digitise-priority").get_json()["items"]
    assert items and {"ML-1001", "ML-1002"}.isdisjoint(i["patient_no"] for i in items)
    assert items == sorted(items, key=lambda i: -i["requests_90_days"])


def test_fake_or_wrong_files_are_refused(client, login):
    login("admin")
    assert upload(client, data=b"not really a pdf").status_code == 415
    assert upload(client, name="notes.docx").status_code == 415
    r = client.post("/api/patients/ML-1003/documents", content_type="multipart/form-data", data={})
    assert r.status_code == 400


def test_delete_document(client, login):
    login("admin")
    doc = upload(client, completes="false").get_json()["document"]
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 200
    assert client.get(f"/api/documents/{doc['id']}/file").status_code == 404

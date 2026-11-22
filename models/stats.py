"""
Live counts and supply chain KPIs.

The KPI functions call the Step 2 supply chain model in models/retrieval.py,
using the real share of digitised patients from the database.
"""
from db import query_all, query_one
from models.retrieval import delayed_retrievals_per_day, monthly_cost, wasted_hours_per_day

# Baseline figures from the neurologist interview (see the proposal).
BASELINE = {
    "retrievals_per_day": 22,
    "delay_rate": 0.45,
    "extra_minutes": 10,
    "best_case_minutes": 5,
    "digital_lookup_minutes": 1,  # assumption, not from the interview
    "hourly_rate": 78,
    "working_days": 22,
}


def live_counts():
    """Counts straight from the database. These change whenever the data changes."""
    patients = query_one("SELECT COUNT(*) AS total, COALESCE(SUM(digitised), 0) AS digitised FROM patients")
    by_status = {r["status"]: r["n"] for r in query_all(
        "SELECT status, COUNT(*) AS n FROM requests GROUP BY status")}
    by_channel = {r["channel"]: r["n"] for r in query_all(
        "SELECT channel, COUNT(*) AS n FROM requests GROUP BY channel ORDER BY n DESC")}
    urgent_open = query_one(
        "SELECT COUNT(*) AS n FROM requests WHERE urgency = 'urgent' AND status <> 'completed'")["n"]
    avg = query_one(
        """SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, completed_at)) / 60 AS hours
           FROM requests WHERE completed_at IS NOT NULL""")["hours"]
    return {
        "patients": int(patients["total"]),
        "digitised_patients": int(patients["digitised"]),
        "digitised_share": round(int(patients["digitised"]) / patients["total"], 3) if patients["total"] else 0,
        "requests": {s: int(by_status.get(s, 0)) for s in ("new", "forwarded", "completed")},
        "urgent_open": int(urgent_open),
        "avg_hours_to_complete": round(float(avg), 1) if avg is not None else None,
        "by_channel": {k: int(v) for k, v in by_channel.items()},
    }


def retrieval_kpis(inputs, digitised_share):
    """
    Before MediLink: every file is on paper.
    With MediLink: digitised files are opened instantly with no delay,
    so only the paper share can still be delayed.
    Uses Stefan's model functions unchanged.
    """
    i = inputs
    paper_share = 1 - digitised_share
    paper_minutes = i["best_case_minutes"] + i["delay_rate"] * i["extra_minutes"]

    def scenario(delay_rate, avg_minutes):
        hours = wasted_hours_per_day(i["retrievals_per_day"], delay_rate, i["extra_minutes"])
        return {
            "delayed_per_day": round(delayed_retrievals_per_day(i["retrievals_per_day"], delay_rate), 2),
            "wasted_hours_per_day": round(hours, 2),
            "monthly_cost": round(monthly_cost(hours, i["hourly_rate"], i["working_days"]), 2),
            "avg_retrieval_minutes": round(avg_minutes, 2),
        }

    before = scenario(i["delay_rate"], paper_minutes)
    after = scenario(i["delay_rate"] * paper_share,
                     digitised_share * i["digital_lookup_minutes"] + paper_share * paper_minutes)
    return {
        "inputs": {**i, "digitised_share": round(digitised_share, 3)},
        "before": before,
        "after": after,
        "savings": {
            "hours_per_day": round(before["wasted_hours_per_day"] - after["wasted_hours_per_day"], 2),
            "per_month": round(before["monthly_cost"] - after["monthly_cost"], 2),
            "per_year": round((before["monthly_cost"] - after["monthly_cost"]) * 12, 2),
        },
    }


def digitise_priority(limit=10, inputs=None):
    """
    Paper-file patients ranked by how much admin cost scanning them would save.
    Each patient's request rate over the last 90 days is fed into the model as
    their share of daily retrievals.
    """
    i = inputs or BASELINE
    rows = query_all(
        """SELECT p.patient_no, CONCAT(p.first_name, ' ', p.surname) AS patient_name,
                  COUNT(r.id) AS requests_90_days,
                  SUM(r.status <> 'completed') AS open_requests
           FROM patients p
           LEFT JOIN requests r ON r.patient_no = p.patient_no AND r.created_at >= NOW() - INTERVAL 90 DAY
           WHERE p.digitised = FALSE
           GROUP BY p.patient_no, p.first_name, p.surname
           ORDER BY requests_90_days DESC, open_requests DESC, p.patient_no
           LIMIT %s""", (limit,))
    ranked = []
    for row in rows:
        retrievals_per_day = int(row["requests_90_days"]) / (90 / 7 * 5)  # about 64 working days in 90 days
        hours = wasted_hours_per_day(retrievals_per_day, i["delay_rate"], i["extra_minutes"])
        ranked.append({
            "patient_no": row["patient_no"],
            "patient_name": row["patient_name"],
            "requests_90_days": int(row["requests_90_days"]),
            "open_requests": int(row["open_requests"] or 0),
            "monthly_saving_if_scanned": round(monthly_cost(hours, i["hourly_rate"], i["working_days"]), 2),
        })
    return ranked

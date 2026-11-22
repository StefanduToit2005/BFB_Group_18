"""KPI endpoints. /retrieval and /digitise-priority run the Step 2 supply chain model."""
from flask import Blueprint, jsonify

from models import stats
from routes.helpers import STAFF_ROLES, float_arg, int_arg, login_required

kpis_bp = Blueprint("kpis", __name__)


@kpis_bp.get("/live")
@login_required(*STAFF_ROLES)
def live():
    """GET /api/kpis/live  - counts straight from the database"""
    return jsonify(stats.live_counts())


def model_inputs():
    """Model inputs from the query string, falling back to the interview baseline."""
    b = stats.BASELINE
    return {
        "retrievals_per_day": float_arg("retrievals_per_day", b["retrievals_per_day"], 0, 1000),
        "delay_rate": float_arg("delay_rate", b["delay_rate"], 0, 1),
        "extra_minutes": float_arg("extra_minutes", b["extra_minutes"], 0, 240),
        "best_case_minutes": float_arg("best_case_minutes", b["best_case_minutes"], 0, 120),
        "digital_lookup_minutes": float_arg("digital_lookup_minutes", b["digital_lookup_minutes"], 0, 60),
        "hourly_rate": float_arg("hourly_rate", b["hourly_rate"], 0, 10_000),
        "working_days": float_arg("working_days", b["working_days"], 1, 31),
    }


@kpis_bp.get("/retrieval")
@login_required("neurologist")
def retrieval():
    """
    GET /api/kpis/retrieval  - before and after cost of file retrieval.
    If digitised_share is not sent, the real share from the database is used,
    so scanning in a paper file changes this KPI straight away.
    """
    inputs = model_inputs()
    share = float_arg("digitised_share", None, 0, 1)
    source = "query"
    if share is None:
        share = stats.live_counts()["digitised_share"]
        source = "database"
    result = stats.retrieval_kpis(inputs, share)
    result["digitised_share_source"] = source
    return jsonify(result)


@kpis_bp.get("/digitise-priority")
@login_required(*STAFF_ROLES)
def digitise_priority():
    """GET /api/kpis/digitise-priority?limit=10  - which paper files to scan first"""
    return jsonify({"items": stats.digitise_priority(limit=int_arg("limit", 10, 1, 50),
                                                       inputs=model_inputs())})

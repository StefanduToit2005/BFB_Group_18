"""Serves the HTML pages in templates/. The pages then call the /api endpoints."""
from flask import Blueprint, abort, render_template

pages_bp = Blueprint("pages", __name__)

PAGES = ("index", "patient-register", "patient-portal", "admin", "patients",
         "patient-file", "neurologist", "dashboard")


@pages_bp.get("/")
def home():
    return render_template("index.html")


@pages_bp.get("/<page>.html")
def page(page):
    if page not in PAGES:
        abort(404)
    return render_template(f"{page}.html")

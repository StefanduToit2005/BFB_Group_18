"""
The API is split into blueprints, one per resource.
register_blueprints() plugs them all into the app.
"""
from routes.auth import auth_bp
from routes.documents import documents_bp
from routes.kpis import kpis_bp
from routes.pages import pages_bp
from routes.patient_requests import requests_bp
from routes.patients import patients_bp


def register_blueprints(app):
    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(patients_bp, url_prefix="/api/patients")
    app.register_blueprint(requests_bp, url_prefix="/api/requests")
    app.register_blueprint(documents_bp, url_prefix="/api")
    app.register_blueprint(kpis_bp, url_prefix="/api/kpis")

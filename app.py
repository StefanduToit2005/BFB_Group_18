"""
MediLink - Flask application entry point.

Creates the Flask app, connects the database, registers the API
blueprints and sets up logging and error handling.

Run it with:   python app.py
"""
import logging
import os
from logging.handlers import RotatingFileHandler

from flask import Flask

import db
from config import config_by_name
from routes import register_blueprints
from routes.errors import register_error_handlers

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def configure_logging(app):
    """Log to the console and to logs/medilink.log, with time, level and message."""
    log_dir = os.path.join(BASE_DIR, "logs")
    os.makedirs(log_dir, exist_ok=True)
    formatter = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")

    file_handler = RotatingFileHandler(
        os.path.join(log_dir, "medilink.log"), maxBytes=1_000_000, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    level = logging.DEBUG if app.debug else logging.INFO
    app.logger.handlers.clear()
    for handler in (file_handler, console_handler):
        handler.setLevel(level)
        app.logger.addHandler(handler)
    app.logger.setLevel(level)


def create_app(config_name=None):
    """Build and return the Flask app. config_name is development, testing or production."""
    config_name = config_name or os.getenv("FLASK_ENV_NAME", "development")
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # Settings the API needs. config.py can override any of them.
    app.config.setdefault("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
    app.config.setdefault("MAX_UPLOAD_MB", 20)
    app.config["MAX_CONTENT_LENGTH"] = app.config["MAX_UPLOAD_MB"] * 1024 * 1024 + 1024 * 64
    app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
    app.config.setdefault("SESSION_COOKIE_SAMESITE", "Lax")

    configure_logging(app)
    db.init_app(app)
    register_blueprints(app)
    register_error_handlers(app)

    app.logger.info("MediLink started in %s mode", config_name)
    return app


if __name__ == "__main__":
    create_app().run(debug=True)

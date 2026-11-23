"""
Central error handling.

Every error leaves the API in the same JSON shape:
    {"error": {"code": 400, "message": "...", "field": "phone"}}
Failed database writes are rolled back, and unexpected errors are
logged with their stack trace but never shown to the user.
"""
import pymysql
from flask import current_app, g, jsonify, request
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    """Raise this anywhere in the API to send a clean error to the front end."""

    def __init__(self, code, message, field=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.field = field


def error_response(code, message, field=None):
    body = {"code": code, "message": message}
    if field:
        body["field"] = field
    return jsonify({"error": body}), code


def rollback_open_transaction():
    """Undo any half-finished database write from this request."""
    conn = g.get("db")
    if conn is not None:
        try:
            conn.rollback()
        except pymysql.MySQLError:
            current_app.logger.exception("Rollback failed")


def register_error_handlers(app):

    @app.errorhandler(ApiError)
    def handle_api_error(err):
        rollback_open_transaction()
        level = app.logger.warning if err.code < 500 else app.logger.error
        level("%s %s -> %s %s", request.method, request.path, err.code, err.message)
        return error_response(err.code, err.message, err.field)

    @app.errorhandler(pymysql.err.IntegrityError)
    def handle_integrity_error(err):
        rollback_open_transaction()
        app.logger.warning("%s %s -> 409 integrity error: %s", request.method, request.path, err)
        return error_response(409, "That record clashes with one that already exists.")

    @app.errorhandler(pymysql.MySQLError)
    def handle_database_error(err):
        rollback_open_transaction()
        app.logger.exception("%s %s -> database error", request.method, request.path)
        return error_response(503, "The database is not available right now. Please try again.")

    @app.errorhandler(HTTPException)
    def handle_http_error(err):
        rollback_open_transaction()
        messages = {
            400: "The request could not be understood.",
            404: "That page or record was not found.",
            405: "That action is not allowed on this address.",
            413: f"The file is too big. The limit is {app.config['MAX_UPLOAD_MB']} MB.",
        }
        app.logger.warning("%s %s -> %s", request.method, request.path, err.code)
        return error_response(err.code, messages.get(err.code, err.description))

    @app.errorhandler(Exception)
    def handle_unexpected_error(err):
        rollback_open_transaction()
        app.logger.exception("%s %s -> unexpected error", request.method, request.path)
        return error_response(500, "Something went wrong on our side. It has been logged.")

"""
Database helper for MediLink (MySQL through PyMySQL).

Settings come from the environment (.env), never from the code. The tests
switch to the test database by setting DB_NAME before this module is used,
so connect() reads DB_NAME each time it is called.

One connection is opened per request, kept on flask.g, and closed
automatically when the request ends.
"""
import os

import pymysql
from dotenv import load_dotenv
from flask import g
from pymysql.cursors import DictCursor

load_dotenv()


def connect():
    """Open a new MySQL connection from the environment settings."""
    return pymysql.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME"),
        charset="utf8mb4",
        cursorclass=DictCursor,   # rows come back as dictionaries
        autocommit=False,         # we commit ourselves, so a failure can be rolled back
    )


def get_db():
    """Return this request's connection, opening it the first time."""
    if "db" not in g:
        g.db = connect()
    return g.db


def close_db(error=None):
    """Close the connection at the end of the request. Undo unsaved work if it failed."""
    conn = g.pop("db", None)
    if conn is not None:
        if error is not None:
            conn.rollback()
        conn.close()


def query_all(sql, params=None):
    """Run a SELECT and return every row as a list of dictionaries."""
    with get_db().cursor() as cursor:
        cursor.execute(sql, params or ())
        return cursor.fetchall()


def query_one(sql, params=None):
    """Run a SELECT and return the first row as a dictionary, or None."""
    with get_db().cursor() as cursor:
        cursor.execute(sql, params or ())
        return cursor.fetchone()


def execute(sql, params=None, commit=True):
    """
    Run an INSERT, UPDATE or DELETE and return the id of the new row (0 if none).

    The change is saved straight away. Pass commit=False to group several
    writes into one transaction, then call get_db().commit() yourself.
    """
    conn = get_db()
    with conn.cursor() as cursor:
        cursor.execute(sql, params or ())
        new_id = cursor.lastrowid
    if commit:
        conn.commit()
    return new_id


def init_app(app):
    """Register the cleanup so every request closes its own connection."""
    app.teardown_appcontext(close_db)
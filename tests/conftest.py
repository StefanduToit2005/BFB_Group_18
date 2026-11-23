"""
Shared test setup.

The API tests run against a separate MySQL database (TEST_DB_NAME in .env,
default medilink_test). Before every test it is rebuilt from the project's
schema.sql plus the fixed test data in tests/test_data.sql, so tests never
touch real data and never depend on each other.
"""
import os

import pymysql
import pytest
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT, ".env"))

# Point the app at the test database BEFORE db.py is imported.
os.environ["DB_NAME"] = os.getenv("TEST_DB_NAME", "medilink_test")

from app import create_app  # noqa: E402


def run_sql_file(cursor, path):
    """Run every statement in a .sql file, skipping comment lines."""
    with open(path, encoding="utf-8") as f:
        sql = "\n".join(line for line in f.read().splitlines() if not line.strip().startswith("--"))
    for statement in (s.strip() for s in sql.split(";")):
        if statement:
            cursor.execute(statement)


def rebuild_test_database():
    conn = pymysql.connect(host=os.getenv("DB_HOST", "127.0.0.1"), port=int(os.getenv("DB_PORT", "3306")),
                           user=os.getenv("DB_USER"), password=os.getenv("DB_PASSWORD", ""),
                           database=os.environ["DB_NAME"], autocommit=False)
    try:
        with conn.cursor() as cur:
            run_sql_file(cur, os.path.join(ROOT, "schema.sql"))
            run_sql_file(cur, os.path.join(ROOT, "tests", "test_data.sql"))
        conn.commit()
    finally:
        conn.close()

PASSWORDS = {"admin": "Admin@123", "neurologist": "Neuro@123", "patient": "Patient@123"}
USERNAMES = {"admin": "admin", "neurologist": "neuro", "patient": "ML-1001"}


@pytest.fixture
def app(tmp_path):
    rebuild_test_database()
    application = create_app("testing")
    application.config["UPLOAD_FOLDER"] = str(tmp_path / "uploads")
    return application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def login(client):
    """login('admin') logs the test client in as that role and returns the client."""
    def _login(role, username=None, password=None):
        response = client.post("/api/auth/login", json={
            "role": role, "username": username or USERNAMES[role], "password": password or PASSWORDS[role]})
        assert response.status_code == 200, response.get_json()
        return client
    return _login

"""
Settings for each environment.

app.py picks one of these with config_by_name[name]. The database settings are
not here on purpose: db.py reads DB_HOST, DB_USER, DB_PASSWORD and DB_NAME from
the environment, so the tests can switch to the test database.
"""
import os

from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    """Settings shared by every environment."""
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
    DEBUG = False
    TESTING = False
    MAX_UPLOAD_MB = 20


class DevelopmentConfig(BaseConfig):
    """Your own computer: debug on, friendly errors."""
    DEBUG = True


class TestingConfig(BaseConfig):
    """pytest: fixed secret key, testing flag on."""
    TESTING = True
    SECRET_KEY = "test-secret-key"


class ProductionConfig(BaseConfig):
    """Live server: debug off, secret key must come from the environment."""
    SECRET_KEY = os.getenv("SECRET_KEY")


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
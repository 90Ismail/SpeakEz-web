import pytest
from pydantic import ValidationError

from app.config import Settings


def settings(**overrides):
    values = {"jwt_secret": "real-secret", "email_pepper": "real-pepper", "demo_mode": False}
    return Settings(_env_file=None, **{**values, **overrides})


@pytest.mark.parametrize("field,default", [("jwt_secret", "change-me"), ("email_pepper", "change-me-too")])
def test_default_secret_refused_outside_demo_mode(field, default):
    with pytest.raises(ValidationError, match=field.upper()):
        settings(**{field: default})


@pytest.mark.parametrize("field,default", [("jwt_secret", "change-me"), ("email_pepper", "change-me-too")])
def test_default_secret_allowed_in_demo_mode(field, default):
    assert getattr(settings(demo_mode=True, **{field: default}), field) == default


def test_real_secrets_start_outside_demo_mode():
    assert settings().demo_mode is False


def test_demo_mode_is_off_by_default(monkeypatch):
    monkeypatch.delenv("DEMO_MODE", raising=False)
    assert Settings(_env_file=None, jwt_secret="real-secret", email_pepper="real-pepper").demo_mode is False

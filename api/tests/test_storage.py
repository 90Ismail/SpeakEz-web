from urllib.parse import parse_qs, urlparse

import pytest

from app import storage
from app.storage import SignedUrlError


def _query(url: str) -> tuple[int, str]:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    return int(query["expires"][0]), query["signature"][0]


def test_signed_url_round_trip():
    url = storage.signed_url("audios/note.m4a", ttl_seconds=60)
    assert url.startswith("/media/audios/note.m4a?expires=")
    expires, signature = _query(url)
    storage.verify_signed_url("audios/note.m4a", expires, signature)


def test_signed_url_rejects_tampered_key():
    url = storage.signed_url("audios/note.m4a", ttl_seconds=60)
    expires, signature = _query(url)
    with pytest.raises(SignedUrlError):
        storage.verify_signed_url("audios/other.m4a", expires, signature)


def test_signed_url_rejects_expired():
    url = storage.signed_url("audios/note.m4a", ttl_seconds=-1)
    expires, signature = _query(url)
    with pytest.raises(SignedUrlError):
        storage.verify_signed_url("audios/note.m4a", expires, signature)


def test_signed_url_rejects_missing_signature():
    with pytest.raises(SignedUrlError):
        storage.verify_signed_url("audios/note.m4a", None, None)

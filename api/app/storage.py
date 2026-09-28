"""Audio storage behind one interface: save, open, signed_url, delete.

Local disk (`MEDIA_DIR`) is the demo backend; Cloudflare R2 drops in later by
config. `signed_url` may return an absolute URL (R2 presign) or a path relative
to the API host (local disk); clients resolve both against their API base.
"""

import hashlib
import hmac
import time
from pathlib import Path

from .config import get_settings

MEDIA_URL_PREFIX = "/media"
SIGNED_URL_TTL_SECONDS = 60


class MissingMedia(Exception):
    pass


class SignedUrlError(Exception):
    pass


def _root() -> Path:
    return Path(get_settings().media_dir).resolve()


def resolve(key: str) -> Path:
    root = _root()
    target = (root / key).resolve()
    if not target.is_relative_to(root):
        raise MissingMedia("key escapes the media directory")
    if not target.is_file():
        raise MissingMedia(key)
    return target


def save(key: str, data: bytes) -> None:
    target = _root() / key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def open(key: str) -> bytes:  # noqa: A001 - the interface name from tech-stack.md
    return resolve(key).read_bytes()


def delete(key: str) -> None:
    try:
        resolve(key).unlink()
    except MissingMedia:
        pass


def _signature(key: str, expires: int) -> str:
    message = f"{key}:{expires}".encode()
    return hmac.new(get_settings().jwt_secret.encode(), message, hashlib.sha256).hexdigest()


def signed_url(key: str, ttl_seconds: int = SIGNED_URL_TTL_SECONDS) -> str:
    expires = int(time.time()) + ttl_seconds
    return f"{MEDIA_URL_PREFIX}/{key}?expires={expires}&signature={_signature(key, expires)}"


def verify_signed_url(key: str, expires: int | None, signature: str | None) -> None:
    if expires is None or not signature or expires < int(time.time()):
        raise SignedUrlError("expired or missing signature")
    if not hmac.compare_digest(signature, _signature(key, expires)):
        raise SignedUrlError("bad signature")

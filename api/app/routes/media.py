from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .. import storage

router = APIRouter(tags=["media"])


@router.get("/media/{key:path}")
async def media_file(key: str, expires: int | None = None, signature: str | None = None) -> FileResponse:
    try:
        storage.verify_signed_url(key, expires, signature)
        path = storage.resolve(key)
    except (storage.SignedUrlError, storage.MissingMedia) as exc:
        raise HTTPException(status_code=404, detail="Media not found") from exc
    return FileResponse(path)

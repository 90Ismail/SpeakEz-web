import uuid

from pydantic import BaseModel, Field


class LandmarkOut(BaseModel):
    id: str
    name: str
    lat: float
    lng: float


class MapNoteOut(BaseModel):
    id: uuid.UUID
    title: str | None
    landmark: LandmarkOut
    duration_sec: int | None
    day_label: str


class MapResponse(BaseModel):
    notes: list[MapNoteOut] = Field(default_factory=list)


class HealthOut(BaseModel):
    status: str
    db: bool
    redis: bool


class UnlockRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class WordOut(BaseModel):
    word: str
    start: float
    end: float


class UnlockResponse(BaseModel):
    body: str
    words: list[WordOut] | None = None
    audio_url: str | None = None

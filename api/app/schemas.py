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
    reply_count: int = 0


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
    paragraph: int | None = None


class ReplyOut(BaseModel):
    id: uuid.UUID
    body: str
    audio_url: str | None = None
    duration_sec: int | None = None
    day_label: str


class UnlockResponse(BaseModel):
    body: str
    words: list[WordOut] | None = None
    audio_url: str | None = None
    # The thread under the original post, oldest first.
    replies: list[ReplyOut] = Field(default_factory=list)


class PromptOut(BaseModel):
    id: int
    text: str
    # Campus date the prompt is for, e.g. "2026-09-28".
    date: str

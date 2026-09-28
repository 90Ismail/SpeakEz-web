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

import uuid
from datetime import datetime
from typing import Any

from geoalchemy2 import Geography
from geoalchemy2.elements import WKBElement
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import BYTEA, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NOTE_STATUSES = ("processing", "draft", "held", "blocked", "live")
# public: left at a landmark, anonymous, can go live on the map. journal: only the author, never on the map.
NOTE_VISIBILITIES = ("public", "journal")
REACTION_TYPES = ("heard_you", "same", "strength", "helped")


class Base(DeclarativeBase):
    pass


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_hmac: Mapped[bytes] = mapped_column(BYTEA, unique=True, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'active'"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Landmark(Base):
    __tablename__ = "landmarks"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    zone: Mapped[str] = mapped_column(Text, nullable=False)
    # spatial_index=False: DDL belongs to Alembic, which creates landmarks_geom_gix explicitly.
    geom: Mapped[WKBElement] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False
    )


class Prompt(Base):
    """A daily question for the voice journal. Today's is picked by campus date."""

    __tablename__ = "prompts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    # Required for public notes (checked in the DB); journal entries may have no place.
    landmark_id: Mapped[str | None] = mapped_column(ForeignKey("landmarks.id"))
    title: Mapped[str | None] = mapped_column(Text)
    body: Mapped[str | None] = mapped_column(Text)
    words: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    audio_key: Mapped[str | None] = mapped_column(Text)
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'processing'"))
    visibility: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'public'"))
    # An answer to a daily prompt. Always a journal entry (checked in the DB).
    prompt_id: Mapped[int | None] = mapped_column(ForeignKey("prompts.id"))
    # A voice reply to another note. Always public, never on the map on its own (checked in the DB).
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("notes.id", ondelete="CASCADE"))
    publish_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    seeded: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))


class Reaction(Base):
    __tablename__ = "reactions"
    __table_args__ = (
        CheckConstraint(
            "type in ('heard_you', 'same', 'strength', 'helped')", name="reactions_type_check"
        ),
    )

    note_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), primary_key=True)
    type: Mapped[str] = mapped_column(Text, nullable=False)


class ModerationLog(Base):
    __tablename__ = "moderation_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    note_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("notes.id"))
    layer: Mapped[str | None] = mapped_column(Text)
    label: Mapped[str | None] = mapped_column(Text)
    decision: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

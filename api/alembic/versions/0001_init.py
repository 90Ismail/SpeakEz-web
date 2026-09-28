"""init: accounts, landmarks, notes, reactions, moderation_log

Revision ID: 0001
Revises:
Create Date: 2026-09-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("create extension if not exists postgis")

    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email_hmac", postgresql.BYTEA(), nullable=False, unique=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'active'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "landmarks",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("zone", sa.Text(), nullable=False),
        sa.Column("geom", Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False),
        # TODO(post-demo): zone_polygon geography(Polygon, 4326) for real East/West
        # Bank zones; the demo uses center + radius approximations in src/zones.ts
    )
    op.create_index("landmarks_geom_gix", "landmarks", ["geom"], postgresql_using="gist")

    op.create_table(
        "notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("landmark_id", sa.Text(), sa.ForeignKey("landmarks.id"), nullable=False),
        sa.Column("title", sa.Text()),
        sa.Column("body", sa.Text()),
        sa.Column("words", postgresql.JSONB()),
        sa.Column("audio_key", sa.Text()),
        sa.Column("duration_sec", sa.Integer()),
        # processing|draft|held|blocked|live
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'processing'")),
        sa.Column("publish_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("seeded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(
        "notes_live_idx",
        "notes",
        ["landmark_id"],
        postgresql_where=sa.text("status = 'live'"),
    )

    op.create_table(
        "reactions",
        sa.Column(
            "note_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), primary_key=True
        ),
        sa.Column("type", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "type in ('heard_you', 'same', 'strength', 'helped')", name="reactions_type_check"
        ),
    )

    op.create_table(
        "moderation_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id")),
        sa.Column("layer", sa.Text()),
        sa.Column("label", sa.Text()),
        sa.Column("decision", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("moderation_log")
    op.drop_table("reactions")
    op.drop_index("notes_live_idx", table_name="notes")
    op.drop_table("notes")
    op.drop_index("landmarks_geom_gix", table_name="landmarks")
    op.drop_table("landmarks")
    op.drop_table("accounts")

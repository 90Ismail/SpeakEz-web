"""note visibility: public posts vs private voice journal

A note is either a public post (left at a landmark, anonymous, can go live on
the map) or a voice journal entry (only the author, never on the map). Drafts
stay a status, not a visibility. Journal entries don't need a place, so
landmark_id becomes optional for them; public notes still require one.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notes",
        sa.Column("visibility", sa.Text(), nullable=False, server_default=sa.text("'public'")),
    )
    op.create_check_constraint(
        "notes_visibility_check", "notes", "visibility in ('public', 'journal')"
    )
    op.alter_column("notes", "landmark_id", existing_type=sa.Text(), nullable=True)
    op.create_check_constraint(
        "notes_public_has_landmark",
        "notes",
        "visibility <> 'public' or landmark_id is not null",
    )

    # The map only ever reads live public notes, so the partial index should match that.
    op.drop_index("notes_live_idx", table_name="notes")
    op.create_index(
        "notes_live_idx",
        "notes",
        ["landmark_id"],
        postgresql_where=sa.text("status = 'live' and visibility = 'public'"),
    )


def downgrade() -> None:
    op.drop_index("notes_live_idx", table_name="notes")
    op.create_index(
        "notes_live_idx",
        "notes",
        ["landmark_id"],
        postgresql_where=sa.text("status = 'live'"),
    )
    op.drop_constraint("notes_public_has_landmark", "notes", type_="check")
    # 0001 requires a landmark on every note; unplaced journal entries can't survive the downgrade.
    op.execute("delete from notes where landmark_id is null")
    op.alter_column("notes", "landmark_id", existing_type=sa.Text(), nullable=False)
    op.drop_constraint("notes_visibility_check", "notes", type_="check")
    op.drop_column("notes", "visibility")

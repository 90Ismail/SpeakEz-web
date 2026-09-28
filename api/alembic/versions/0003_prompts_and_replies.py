"""daily prompts and voice replies

prompts: a rotating list of daily questions; the API picks today's by campus date.
notes.prompt_id: an answer to a prompt. Prompt answers belong to the voice
journal only: they are never public and never on the map (checked below).
notes.parent_id: a voice reply to another note. The original post stays first at
its place; replies form a thread under it, are always public, never appear on the
map on their own, and unlock together with their parent.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prompts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("text", sa.Text(), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.add_column("notes", sa.Column("prompt_id", sa.Integer(), sa.ForeignKey("prompts.id")))
    op.add_column(
        "notes",
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
        ),
    )
    op.create_check_constraint(
        "notes_prompt_answers_are_journal",
        "notes",
        "prompt_id is null or visibility = 'journal'",
    )
    op.create_check_constraint(
        "notes_replies_are_public",
        "notes",
        "parent_id is null or visibility = 'public'",
    )
    op.create_index(
        "notes_replies_idx",
        "notes",
        ["parent_id", "created_at"],
        postgresql_where=sa.text("parent_id is not null and status = 'live'"),
    )

    # The map shows original posts only; replies ride along with their parent.
    op.drop_index("notes_live_idx", table_name="notes")
    op.create_index(
        "notes_live_idx",
        "notes",
        ["landmark_id"],
        postgresql_where=sa.text("status = 'live' and visibility = 'public' and parent_id is null"),
    )


def downgrade() -> None:
    op.drop_index("notes_live_idx", table_name="notes")
    op.create_index(
        "notes_live_idx",
        "notes",
        ["landmark_id"],
        postgresql_where=sa.text("status = 'live' and visibility = 'public'"),
    )
    op.drop_index("notes_replies_idx", table_name="notes")
    op.drop_constraint("notes_replies_are_public", "notes", type_="check")
    op.drop_constraint("notes_prompt_answers_are_journal", "notes", type_="check")
    op.drop_column("notes", "parent_id")
    op.drop_column("notes", "prompt_id")
    op.drop_table("prompts")

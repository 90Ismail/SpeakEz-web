"""The draft -> live job: only due drafts whose transcript passed the safety gate go live."""

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.dialects import postgresql

from app.repositories import notes as notes_repo
from app.services import publish as publish_service

NOW = datetime(2026, 9, 28, 21, 0, tzinfo=timezone.utc)


class FakeSession:
    def __init__(self):
        self.commits = 0
        self.statements = []

    async def commit(self):
        self.commits += 1

    async def execute(self, stmt):
        self.statements.append(stmt)
        return type("Result", (), {"scalars": lambda self: iter([])})()


@pytest.fixture
def invalidated(monkeypatch):
    prefixes = []

    async def invalidate(prefix):
        prefixes.append(prefix)
        return 0

    monkeypatch.setattr(publish_service, "invalidate", invalidate)
    return prefixes


async def test_release_commits_and_invalidates_map_cache(monkeypatch, invalidated):
    released = [uuid.uuid4(), uuid.uuid4()]
    calls = []

    async def release_due(session, now, transcript_layer):
        calls.append(transcript_layer)
        return released

    monkeypatch.setattr(notes_repo, "release_due", release_due)
    session = FakeSession()
    assert await publish_service.release_due_notes(session) == 2
    assert calls == ["lexicon.transcript"]
    assert session.commits == 1
    assert invalidated == ["map:"]


async def test_release_with_nothing_due_skips_cache_invalidation(monkeypatch, invalidated):
    async def release_due(session, now, transcript_layer):
        return []

    monkeypatch.setattr(notes_repo, "release_due", release_due)
    assert await publish_service.release_due_notes(FakeSession()) == 0
    assert invalidated == []


async def test_release_query_is_gated_on_status_time_and_transcript_verdict():
    session = FakeSession()
    await notes_repo.release_due(session, NOW, "lexicon.transcript")
    [stmt] = session.statements
    sql = " ".join(
        str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})).split()
    )
    assert sql.startswith("UPDATE notes SET status='live'")
    assert "notes.status = 'draft'" in sql
    assert "notes.publish_at <= '2026-09-28 21:00:00+00:00'" in sql
    assert "EXISTS (SELECT" in sql
    assert "moderation_log.note_id = notes.id" in sql
    assert "moderation_log.layer = 'lexicon.transcript'" in sql
    assert "moderation_log.decision = 'draft'" in sql
    assert "RETURNING notes.id" in sql


# Real Postgres. Skipped when no database is reachable; runs in `docker compose exec api pytest`.
# Everything happens inside a transaction that is rolled back, so no rows are left behind.


@pytest.fixture
async def pg_session():
    try:
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    except ImportError:
        pytest.skip("sqlalchemy asyncio not installed")
    url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://speakez:speakez@db:5432/speakez")
    engine = create_async_engine(url, connect_args={"timeout": 2})
    try:
        conn = await engine.connect()
    except Exception:
        await engine.dispose()
        pytest.skip("no Postgres reachable")
    outer = await conn.begin()
    session = AsyncSession(bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        await session.close()
        await outer.rollback()
        await conn.close()
        await engine.dispose()


async def _insert_note(session, landmark_id, account_id, status, publish_at, logs):
    from app.models import ModerationLog, Note

    note = Note(
        id=uuid.uuid4(),
        author_id=account_id,
        landmark_id=landmark_id,
        title="test",
        status=status,
        publish_at=publish_at,
    )
    session.add(note)
    await session.flush()
    for layer, decision in logs:
        session.add(ModerationLog(note_id=note.id, layer=layer, label=None, decision=decision))
    await session.flush()
    return note.id


async def test_release_against_postgres(pg_session, invalidated):
    from sqlalchemy import select, text

    from app.models import Account, Note

    session = pg_session
    account_id = uuid.uuid4()
    landmark_id = f"test-{uuid.uuid4()}"
    session.add(Account(id=account_id, email_hmac=os.urandom(32)))
    await session.execute(
        text(
            "insert into landmarks (id, name, zone, geom) values "
            "(:id, 'Test', 'east', 'SRID=4326;POINT(-93.2363 44.9754)')"
        ),
        {"id": landmark_id},
    )
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    future = datetime.now(timezone.utc) + timedelta(minutes=30)
    passed = [("lexicon.transcript", "draft")]

    async def note(status, publish_at, logs):
        return await _insert_note(session, landmark_id, account_id, status, publish_at, logs)

    notes = {
        "due_draft": await note("draft", past, passed),
        "held": await note("held", past, [("lexicon.transcript", "held")]),
        "blocked": await note("blocked", past, [("lexicon.transcript", "blocked")]),
        "held_after_clean_transcript": await note("held", past, passed + [("lexicon.title", "held")]),
        "future_draft": await note("draft", future, passed),
        "draft_without_verdict": await note("draft", past, []),
        "draft_with_only_title_verdict": await note("draft", past, [("lexicon.title", "draft")]),
        "draft_with_held_transcript": await note("draft", past, [("lexicon.transcript", "held")]),
    }

    await publish_service.release_due_notes(session)

    rows = await session.execute(select(Note.id, Note.status).where(Note.id.in_(notes.values())))
    status = {note_id: value for note_id, value in rows.all()}
    assert status[notes["due_draft"]] == "live"
    assert status[notes["held"]] == "held"
    assert status[notes["blocked"]] == "blocked"
    assert status[notes["held_after_clean_transcript"]] == "held"
    assert status[notes["future_draft"]] == "draft"
    assert status[notes["draft_without_verdict"]] == "draft"
    assert status[notes["draft_with_only_title_verdict"]] == "draft"
    assert status[notes["draft_with_held_transcript"]] == "draft"
    assert invalidated == ["map:"]

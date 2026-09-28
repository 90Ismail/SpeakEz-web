import uuid

import httpx
import pytest
from fastapi import FastAPI

from app.auth.deps import CurrentUser, current_user
from app.db import get_session
from app.repositories import reactions as repo
from app.routes import reactions
from app.services import reactions as service


@pytest.fixture
async def context(monkeypatch):
    app = FastAPI()
    app.include_router(reactions.router)
    actor = {"id": uuid.uuid4()}
    notes = {uuid.uuid4(), uuid.uuid4()}
    receipts = set()
    saved = {}
    async def session():
        yield None
    async def user():
        return CurrentUser(actor["id"])
    async def public_live(session, note_id):
        return note_id in notes
    async def receipt(key):
        return key in receipts
    async def get(session, note_id, account_id):
        return saved.get((note_id, account_id))
    async def save(session, note_id, account_id, kind):
        if kind is None:
            saved.pop((note_id, account_id), None)
        else:
            saved[(note_id, account_id)] = kind
    app.dependency_overrides[get_session] = session
    app.dependency_overrides[current_user] = user
    monkeypatch.setattr(repo, "public_live", public_live)
    monkeypatch.setattr(repo, "get", get)
    monkeypatch.setattr(repo, "save", save)
    monkeypatch.setattr(service, "get_json", receipt)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client, actor, notes, receipts, saved


async def test_save_reload_replace_remove_and_user_isolation(context):
    client, actor, notes, receipts, saved = context
    note = next(iter(notes))
    receipts.add(f"unlocked:{actor['id']}:{note}")
    path = f"/notes/{note}/reactions"
    for kind in ["heard_you", "same", "strength", "helped", "helped"]:
        response = await client.post(path, json={"type": kind})
        assert response.status_code == 200
        assert response.json() == {"type": kind}
        assert (await client.get(path)).json() == {"type": kind}
        assert len(saved) == 1
    owner = actor["id"]
    actor["id"] = uuid.uuid4()
    receipts.add(f"unlocked:{actor['id']}:{note}")
    assert (await client.get(path)).json() == {"type": None}
    await client.post(path, json={"type": "same"})
    assert saved[(note, owner)] == "helped"
    assert len(saved) == 2
    await client.post(path, json={"type": None})
    assert (await client.get(path)).json() == {"type": None}
    assert saved == {(note, owner): "helped"}


async def test_receipt_is_note_specific_and_expires(context):
    client, actor, notes, receipts, saved = context
    first, second = notes
    receipts.add(f"unlocked:{actor['id']}:{first}")
    assert (await client.post(f"/notes/{second}/reactions", json={"type": "same"})).status_code == 403
    receipts.clear()
    assert (await client.post(f"/notes/{first}/reactions", json={"type": "same"})).status_code == 403
    assert not saved


async def test_nonpublic_or_missing_note_unavailable(context):
    client, actor, notes, receipts, saved = context
    hidden = uuid.uuid4()
    receipts.add(f"unlocked:{actor['id']}:{hidden}")
    path = f"/notes/{hidden}/reactions"
    assert (await client.get(path)).status_code == 404
    assert (await client.post(path, json={"type": "same"})).status_code == 404
    assert not saved


async def test_invalid_reaction_rejected(context):
    client, _, notes, _, saved = context
    response = await client.post(f"/notes/{next(iter(notes))}/reactions", json={"type": "like"})
    assert response.status_code == 422
    assert not saved

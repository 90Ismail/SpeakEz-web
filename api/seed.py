"""Seed campus landmarks and the demo notes.

Run inside the api container: `docker compose exec api python seed.py`.
Landmarks mirror src/campusLandmarks.ts; notes mirror src/seedNotes.ts.
"""

import asyncio
import hashlib
import hmac
import uuid
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from geoalchemy2.elements import WKTElement
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.config import get_settings
from app.db import SessionLocal, engine
from app.models import Account, Landmark, Note

DISPLAY_TZ = ZoneInfo(get_settings().display_timezone)

# Stable ID for the synthetic "early tester" author of the seeded notes.
SEED_AUTHOR_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
SEED_NOTES_NAMESPACE = uuid.UUID("6f3a1a6e-6c1f-4f2e-9a2c-8f1b3d5c7e90")

LANDMARKS = [
    {"id": "walter-library", "name": "Walter Library", "zone": "east", "lat": 44.97536, "lng": -93.2363},
    {"id": "northrop-mall", "name": "Northrop Mall", "zone": "east", "lat": 44.97479, "lng": -93.23531},
    {"id": "coffman-union", "name": "Coffman Union", "zone": "east", "lat": 44.97282, "lng": -93.23535},
    {"id": "pillsbury-hall", "name": "Pillsbury Hall", "zone": "east", "lat": 44.9769, "lng": -93.23444},
    {"id": "the-knoll", "name": "The Knoll", "zone": "east", "lat": 44.97862, "lng": -93.2365},
    {"id": "superblock", "name": "Superblock", "zone": "east", "lat": 44.9749, "lng": -93.2325},
    {"id": "scholars-walk", "name": "Scholars Walk", "zone": "east", "lat": 44.97437, "lng": -93.23694},
    {"id": "washington-ave-bridge", "name": "Washington Ave Bridge", "zone": "east", "lat": 44.97306, "lng": -93.23991},
    {"id": "wilson-library", "name": "Wilson Library", "zone": "west", "lat": 44.97095, "lng": -93.24359},
    {"id": "carlson-school", "name": "Carlson School", "zone": "west", "lat": 44.97046, "lng": -93.24477},
    {"id": "rarig-center", "name": "Rarig Center", "zone": "west", "lat": 44.97046, "lng": -93.24246},
    {"id": "blegen-hall", "name": "Blegen Hall", "zone": "west", "lat": 44.97184, "lng": -93.24334},
]

# days_ago/hour/minute shape created_at so the API's day label matches src/seedNotes.ts
# ("this evening", "last night", "yesterday", ...).
SEED_NOTES = [
    {
        "slug": "tired-at-walter",
        "title": "I don't think anyone knows how tired I am",
        "landmark_id": "walter-library",
        "duration_sec": 134,
        "at": (0, 19, 30),
        "body": [
            "I didn't really know where else to say this, so I'm saying it here — on the steps outside Walter, where I've basically lived for the last three weeks.",
            "Everyone keeps telling me I'm doing great. My advisor, my friends, my parents on the phone on Sundays. And I nod, and I say thanks, and then I come back here and sit with my laptop until the lights upstairs flicker off.",
            "It's not that anything terrible happened. It's more like everything is quietly asking for a little more than I have left.",
            "I think I just wanted one person to know. Not to fix it. Just to know that someone was sitting here tonight, tired, and still trying.",
            "If you're hearing this nearby — I hope your night is gentler than mine was.",
        ],
    },
    {
        "slug": "failing-first-semester",
        "title": "I think I'm failing my first semester",
        "landmark_id": "northrop-mall",
        "duration_sec": 98,
        "at": (1, 23, 0),
        "body": [
            "I got my first exam back today and it was worse than I let anyone believe.",
            "I keep telling myself it's just one class, but it's the way everyone nods when I say it that gets to me.",
        ],
    },
    {
        "slug": "strangely-peaceful",
        "title": "Tonight felt strangely peaceful",
        "landmark_id": "the-knoll",
        "duration_sec": 76,
        "at": (0, 20, 15),
        "body": [
            "I walked up here after my shift and the whole hill was quiet.",
            "For once I wasn't thinking about everything due tomorrow. I just watched the lights come on across the river.",
        ],
    },
    {
        "slug": "roommate",
        "title": "I don't know how to tell my roommate",
        "landmark_id": "coffman-union",
        "duration_sec": 152,
        "at": (1, 15, 0),
        "body": [
            "Something happened over winter break and I haven't told anyone here yet.",
            "She's my best friend. That's exactly why I can't figure out how to say it.",
        ],
    },
    {
        "slug": "nowhere-else",
        "title": "I didn't know where else to say this",
        "landmark_id": "wilson-library",
        "duration_sec": 111,
        "at": (0, 17, 45),
        "body": [
            "I come to the west bank to study because nobody looks for me here.",
            "Some things you can't put in a group chat. So here it is instead.",
        ],
    },
    {
        "slug": "cant-sleep",
        "title": "I walk here when I can't sleep",
        "landmark_id": "pillsbury-hall",
        "duration_sec": 87,
        "at": (1, 2, 0),
        "body": [
            "It was 2 a.m. and the whole mall was empty.",
            "I walked past Pillsbury Hall three times before I realized I wasn't going back to bed.",
        ],
    },
    {
        "slug": "figured-out",
        "title": "Everyone here seems to have it figured out",
        "landmark_id": "carlson-school",
        "duration_sec": 124,
        "at": (0, 13, 30),
        "body": [
            "Group projects are the worst for this. Everyone has a plan and a spreadsheet and a fall internship already.",
            "I just keep nodding and hoping nobody notices I'm guessing.",
        ],
    },
    {
        "slug": "organic-chem",
        "title": "My first A in organic chemistry",
        "landmark_id": "blegen-hall",
        "duration_sec": 95,
        "at": (0, 9, 15),
        "body": [
            "I studied for this exam at every bus stop I've ever missed a bus at.",
            "It's one grade. But it's the first time this year I felt like I belong here.",
        ],
    },
]


def created_at_for(days_ago: int, hour: int, minute: int, now: datetime) -> datetime:
    """Local (campus) wall-clock time → UTC.

    Notes are pinned to the day they're seeded on so their day labels match
    src/seedNotes.ts; re-run this script on demo day.
    """
    local_now = now.astimezone(DISPLAY_TZ)
    target_date = (local_now - timedelta(days=days_ago)).date()
    local = datetime.combine(target_date, time(hour, minute), tzinfo=DISPLAY_TZ)
    return local.astimezone(timezone.utc)


async def seed() -> None:
    settings = get_settings()
    now = datetime.now(timezone.utc)

    async with SessionLocal() as session:
        landmark_rows = [
            {
                "id": landmark["id"],
                "name": landmark["name"],
                "zone": landmark["zone"],
                "geom": WKTElement(f"POINT({landmark['lng']} {landmark['lat']})", srid=4326),
            }
            for landmark in LANDMARKS
        ]
        landmark_stmt = insert(Landmark).values(landmark_rows)
        landmark_stmt = landmark_stmt.on_conflict_do_update(
            index_elements=[Landmark.id],
            set_={
                "name": landmark_stmt.excluded.name,
                "zone": landmark_stmt.excluded.zone,
                "geom": landmark_stmt.excluded.geom,
            },
        )
        await session.execute(landmark_stmt)

        email_hmac = hmac.new(
            settings.email_pepper.encode(), b"early-tester@umn.edu", hashlib.sha256
        ).digest()
        existing_author = await session.scalar(
            select(Account.id).where(Account.email_hmac == email_hmac)
        )
        author_id = existing_author or SEED_AUTHOR_ID
        if existing_author is None:
            session.add(Account(id=author_id, email_hmac=email_hmac))

        await session.execute(delete(Note).where(Note.seeded.is_(True)))

        for entry in SEED_NOTES:
            days_ago, hour, minute = entry["at"]
            created_at = created_at_for(days_ago, hour, minute, now)
            session.add(
                Note(
                    id=uuid.uuid5(SEED_NOTES_NAMESPACE, entry["slug"]),
                    author_id=author_id,
                    landmark_id=entry["landmark_id"],
                    title=entry["title"],
                    body="\n\n".join(entry["body"]),
                    duration_sec=entry["duration_sec"],
                    status="live",
                    publish_at=created_at,
                    created_at=created_at,
                    seeded=True,
                )
            )

        await session.commit()

    await engine.dispose()
    print(f"seeded {len(LANDMARKS)} landmarks and {len(SEED_NOTES)} notes")


if __name__ == "__main__":
    asyncio.run(seed())

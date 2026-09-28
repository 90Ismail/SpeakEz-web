from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.services.notes import day_label

CHICAGO = ZoneInfo("America/Chicago")


def chicago(year, month, day, hour, minute=0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=CHICAGO)


NOW = chicago(2026, 9, 28, 21, 0).astimezone(timezone.utc)


def test_today_parts_of_day():
    assert day_label(chicago(2026, 9, 28, 2, 0).astimezone(timezone.utc), NOW) == "tonight"
    assert day_label(chicago(2026, 9, 28, 9, 15).astimezone(timezone.utc), NOW) == "this morning"
    assert day_label(chicago(2026, 9, 28, 13, 30).astimezone(timezone.utc), NOW) == "this afternoon"
    assert day_label(chicago(2026, 9, 28, 19, 30).astimezone(timezone.utc), NOW) == "this evening"
    assert day_label(chicago(2026, 9, 28, 23, 30).astimezone(timezone.utc), NOW) == "tonight"


def test_yesterday():
    assert day_label(chicago(2026, 9, 27, 15, 0).astimezone(timezone.utc), NOW) == "yesterday"
    assert day_label(chicago(2026, 9, 27, 23, 0).astimezone(timezone.utc), NOW) == "last night"
    assert day_label(chicago(2026, 9, 27, 2, 0).astimezone(timezone.utc), NOW) == "last night"


def test_this_week_and_older():
    assert day_label(chicago(2026, 9, 24, 12, 0).astimezone(timezone.utc), NOW) == "thursday"
    assert day_label(chicago(2026, 9, 10, 12, 0).astimezone(timezone.utc), NOW) == "earlier this month"


def test_utc_note_lands_on_a_single_day_boundary():
    # 04:30 UTC on the 28th is 11:30 pm on the 27th in Chicago.
    created = datetime(2026, 9, 28, 4, 30, tzinfo=timezone.utc)
    assert day_label(created, NOW) == "last night"


def test_label_has_no_digits():
    assert not any(char.isdigit() for char in day_label(NOW, NOW))

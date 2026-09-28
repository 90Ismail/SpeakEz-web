from datetime import date, datetime, timezone

import pytest

from app.services.prompts import campus_today, prompt_index


def test_same_prompt_all_day():
    assert prompt_index(date(2026, 9, 28), 12) == prompt_index(date(2026, 9, 28), 12)


def test_prompt_moves_on_each_day_and_wraps():
    days = [date(2026, 9, 28 + offset) for offset in range(3)]
    indices = [prompt_index(day, 12) for day in days]
    assert indices[1] == (indices[0] + 1) % 12
    assert indices[2] == (indices[0] + 2) % 12
    assert all(0 <= index < 12 for index in indices)


def test_prompt_index_needs_prompts():
    with pytest.raises(ValueError):
        prompt_index(date(2026, 9, 28), 0)


def test_day_turns_over_at_campus_midnight_not_utc():
    # 03:30 UTC on the 29th is still the evening of the 28th in Minneapolis.
    assert campus_today(datetime(2026, 9, 29, 3, 30, tzinfo=timezone.utc)) == date(2026, 9, 28)
    assert campus_today(datetime(2026, 9, 29, 6, 0, tzinfo=timezone.utc)) == date(2026, 9, 29)

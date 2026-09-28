from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from ..cache import get_or_set
from ..config import get_settings
from ..repositories import notes as notes_repo
from ..schemas import PromptOut

PROMPT_CACHE_TTL_SECONDS = 600


class NoPrompts(Exception):
    pass


def campus_today(now: datetime | None = None) -> date:
    now = now or datetime.now(timezone.utc)
    return now.astimezone(ZoneInfo(get_settings().display_timezone)).date()


def prompt_index(day: date, count: int) -> int:
    """Everyone gets the same prompt on a given campus day, and it moves on at local midnight."""
    if count <= 0:
        raise ValueError("no prompts")
    return day.toordinal() % count


async def today_prompt(session: AsyncSession, now: datetime | None = None) -> PromptOut:
    """Today's journal prompt. Answers to it are private voice journal entries, never public."""
    day = campus_today(now)

    async def load() -> dict | None:
        prompts = await notes_repo.all_prompts(session)
        if not prompts:
            return None
        prompt = prompts[prompt_index(day, len(prompts))]
        return PromptOut(id=prompt.id, text=prompt.text, date=day.isoformat()).model_dump()

    cached = await get_or_set(f"prompt:{day.isoformat()}", PROMPT_CACHE_TTL_SECONDS, load)
    if cached is None:
        raise NoPrompts
    return PromptOut.model_validate(cached)

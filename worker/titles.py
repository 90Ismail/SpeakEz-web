"""Note titles: one short LLM call on the transcript, first-sentence fallback.

The fallback needs no API key and is what the demo uses until a title provider
is configured. `title_for` is async so the LLM call can drop in without callers
changing.
"""

MAX_TITLE_CHARS = 80
SENTENCE_ENDINGS = ".!?"


def _first_sentence(transcript: str) -> str:
    text = " ".join(transcript.split())
    if not text:
        return ""
    end = len(text)
    for index, char in enumerate(text):
        if char in SENTENCE_ENDINGS:
            end = index + 1
            break
    title = text[:end]
    if len(title) <= MAX_TITLE_CHARS:
        return title
    cut = title[:MAX_TITLE_CHARS].rsplit(" ", 1)[0].rstrip(",;:-")
    return f"{cut}…"


async def title_for(transcript: str) -> str:
    """LLM title when a provider is configured, else the first-sentence fallback."""
    return _first_sentence(transcript)

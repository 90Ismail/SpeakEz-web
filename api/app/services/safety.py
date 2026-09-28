"""Safety gate: check a transcript against the versioned lexicon before a note can go live.

check_transcript is pure and deterministic: no DB, Redis, settings, network or LLM calls. The
worker imports it directly (worker/README.md, phase 1) so there is one implementation.
record_verdict is the separate step that writes the result to moderation_log.
"""

import re
import unicodedata
import uuid
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import TYPE_CHECKING

import yaml

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

LEXICON_PATH = Path(__file__).resolve().parent.parent / "safety" / "lexicon.v1.yaml"
LAYER = "lexicon"
# What a verdict was about; logged as "lexicon.transcript" / "lexicon.title".
SOURCES = ("transcript", "title")

# Checked in this order; the first category with a match decides.
CATEGORY_DECISIONS = (("threat", "blocked"), ("self_harm", "held"))
CLEAN_DECISION = "draft"

# Digits read as letters inside a word ("k1ll", "5ewerslide"). Pure numbers ("988") are left alone.
_LEET_DIGITS = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t"})
# Symbols read as letters when a letter or digit follows them ("$uicide", "k!ll"), not at word ends ("help!").
_LEET_SYMBOLS = {"@": "a", "$": "s", "!": "i"}
CLAUSE_BREAK = "|"
# Runs of this many single characters are read as one spelled-out word ("k m s" -> "kms").
_SPELLED_OUT_MIN = 3


@dataclass(frozen=True)
class SafetyVerdict:
    decision: str  # "draft" | "held" | "blocked"
    label: str | None  # which lexicon entry matched, None if clean
    layer: str  # "lexicon"
    lexicon_version: int


@dataclass(frozen=True)
class _Entry:
    label: str
    regex: re.Pattern[str]


@dataclass(frozen=True)
class _Lexicon:
    version: int
    categories: dict[str, tuple[_Entry, ...]]


def normalize(text: str) -> str:
    """Reduce text to lowercase a-z/0-9 words, single spaces and "|" clause breaks.

    Undoes the usual ways of dodging a filter: accents, mixed case, leetspeak, punctuation
    between letters ("k.m.s", "k*m*s"), and spelled-out letters ("k m s", "k-m-s").
    """
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = re.sub(r"['’`]", "", text)  # "don't" -> "dont"
    text = re.sub(r"[@$!](?=[a-z0-9])", lambda m: _LEET_SYMBOLS[m.group()], text)
    # Punctuation that ends a clause becomes a break, so phrases can't match across sentences.
    text = re.sub(r"[.,;:!?]+(?=\s|$)", f" {CLAUSE_BREAK} ", text)
    text = re.sub(r"[-_/\\]", " ", text)
    text = re.sub(r"[^a-z0-9\s|]", "", text)  # punctuation left is inside a word: drop it

    words: list[str] = []
    for token in text.split():
        if any(ch.isalpha() for ch in token) and any(ch.isdigit() for ch in token):
            token = token.translate(_LEET_DIGITS)
        words.append(token)
    return " ".join(_join_spelled_out(words))


def _join_spelled_out(words: list[str]) -> list[str]:
    joined: list[str] = []
    run: list[str] = []
    for word in [*words, ""]:
        if len(word) == 1 and word.isalnum():
            run.append(word)
            continue
        if len(run) >= _SPELLED_OUT_MIN:
            joined.append("".join(run))
        else:
            joined.extend(run)
        run = []
        if word:
            joined.append(word)
    return joined


def _term_pattern(term: str) -> str:
    """Regex for a plain phrase, tolerating stretched letters ("kmsss", "unaliiive")."""
    normalized = normalize(term)
    return "".join(
        " " if ch == " " else f"{re.escape(ch)}+" if ch.isalpha() else re.escape(ch)
        for ch in normalized
    )


def _expand_vocab(pattern: str, vocab: dict[str, str]) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: vocab[m.group(1)], pattern)


def _compile_entry(raw: dict, vocab: dict[str, str]) -> _Entry:
    parts = [_term_pattern(term) for term in raw.get("terms", [])]
    parts += [_expand_vocab(pattern, vocab) for pattern in raw.get("patterns", [])]
    if not parts:
        raise ValueError(f"lexicon entry {raw['label']!r} has no terms or patterns")
    alternatives = "|".join(f"(?:{part})" for part in parts)
    return _Entry(label=raw["label"], regex=re.compile(rf"(?<![a-z0-9])(?:{alternatives})(?![a-z0-9])"))


@cache
def load_lexicon(path: Path = LEXICON_PATH) -> _Lexicon:
    """Parse and compile the lexicon once; later calls reuse the cached result."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    vocab = {
        name: "|".join(re.escape(normalize(item)) for item in sorted(items, key=len, reverse=True))
        for name, items in raw.get("vocab", {}).items()
    }
    categories = {
        category: tuple(_compile_entry(entry, vocab) for entry in raw.get(category, []))
        for category, _ in CATEGORY_DECISIONS
    }
    labels = [entry.label for entries in categories.values() for entry in entries]
    if len(labels) != len(set(labels)):
        raise ValueError("lexicon labels must be unique")
    return _Lexicon(version=int(raw["version"]), categories=categories)


def check_transcript(text: str) -> SafetyVerdict:
    """Decide "blocked" (threat), "held" (self-harm) or "draft" (clean) for a transcript."""
    lexicon = load_lexicon()
    normalized = normalize(text)
    for category, decision in CATEGORY_DECISIONS:
        for entry in lexicon.categories[category]:
            if entry.regex.search(normalized):
                return SafetyVerdict(decision, entry.label, LAYER, lexicon.version)
    return SafetyVerdict(CLEAN_DECISION, None, LAYER, lexicon.version)


async def record_verdict(
    session: "AsyncSession", note_id: uuid.UUID, verdict: SafetyVerdict, source: str = "transcript"
) -> None:
    """Write the verdict to moderation_log. Call it for every verdict, clean ones included.

    `source` says what was checked ("transcript" or "title") and is logged as the layer, e.g.
    "lexicon.title". Only note_id, layer, label and decision are stored: never the text itself,
    author, email or position. The caller commits.
    """
    if source not in SOURCES:
        raise ValueError(f"source must be one of {SOURCES}")
    # Imported here so importing check_transcript never pulls in the database layer.
    from ..repositories import moderation as moderation_repo

    await moderation_repo.insert_log(
        session, note_id, f"{verdict.layer}.{source}", verdict.label, verdict.decision
    )

import subprocess
import sys
import uuid
from pathlib import Path

import pytest
import yaml

from app.models import ModerationLog
from app.repositories import moderation as moderation_repo
from app.repositories import notes as notes_repo
from app.services import safety
from app.services.safety import apply_transcript_verdict, check_transcript, record_verdict

NOTE_ID = uuid.uuid4()

# One real-sounding transcript per lexicon entry. A new entry needs a sample here
# (test_every_entry_has_a_sample fails otherwise).
SELF_HARM_SAMPLES = {
    "self_harm.unalive": "Honestly some nights I just want to unalive myself.",
    "self_harm.sewerslide": "I keep thinking about sewerslide on the walk home.",
    "self_harm.suicide": "I've been having suicidal thoughts since midterms.",
    "self_harm.kms": "Failed the exam again, kms.",
    "self_harm.kill_myself": "Sometimes I think about how I'd kill myself.",
    "self_harm.end_it": "I sat on the steps and thought about how to end it all.",
    "self_harm.not_be_here": "I don't want to be here anymore.",
    "self_harm.want_to_die": "I wanna die, everything is too much.",
    "self_harm.self_injury": "I started cutting myself again last week.",
}

THREAT_SAMPLES = {
    "threat.kill_person": "My roommate keeps stealing my food, I'm gonna kill him.",
    "threat.attack_place": "I'm going to shoot up Coffman tomorrow.",
    "threat.mass_violence": "Somebody should kill everyone in that lecture.",
    "threat.kys": "If you're reading this near Walter, kys.",
}


def lexicon_labels(category):
    raw = yaml.safe_load(safety.LEXICON_PATH.read_text(encoding="utf-8"))
    return {entry["label"] for entry in raw[category]}


def test_every_entry_has_a_sample():
    assert set(SELF_HARM_SAMPLES) == lexicon_labels("self_harm")
    assert set(THREAT_SAMPLES) == lexicon_labels("threat")


def test_clean_transcript_is_draft():
    verdict = check_transcript(
        "Walked past Northrop tonight and the lights were on. It felt like the semester might be okay."
    )
    assert verdict.decision == "draft"
    assert verdict.label is None
    assert verdict.layer == "lexicon"


def test_empty_transcript_is_draft():
    assert check_transcript("").decision == "draft"


@pytest.mark.parametrize("label,text", SELF_HARM_SAMPLES.items())
def test_self_harm_is_held(label, text):
    verdict = check_transcript(text)
    assert verdict.decision == "held"
    assert verdict.label == label


@pytest.mark.parametrize("label,text", THREAT_SAMPLES.items())
def test_threat_is_blocked(label, text):
    verdict = check_transcript(text)
    assert verdict.decision == "blocked"
    assert verdict.label == label


def test_threat_wins_over_self_harm():
    verdict = check_transcript("I want to die, and I'm going to kill him first.")
    assert verdict.decision == "blocked"
    assert verdict.label == "threat.kill_person"


def test_demo_definition_of_done_phrase_is_held():
    verdict = check_transcript("I want to unalive myself")
    assert verdict.decision == "held"
    assert verdict.label == "self_harm.unalive"


@pytest.mark.parametrize(
    "text,label",
    [
        # extra spaces
        ("i   want   to    unalive     myself", "self_harm.unalive"),
        ("k m s", "self_harm.kms"),
        ("u n a l i v e", "self_harm.unalive"),
        # punctuation between letters
        ("k.m.s", "self_harm.kms"),
        ("k-m-s", "self_harm.kms"),
        ("un*alive", "self_harm.unalive"),
        ("sewer-slide", "self_harm.sewerslide"),
        # mixed case
        ("UnAlIvE", "self_harm.unalive"),
        ("KMS", "self_harm.kms"),
        # leetspeak
        ("un4l1ve", "self_harm.unalive"),
        ("$u1c1de", "self_harm.suicide"),
        ("k!ll mys3lf", "self_harm.kill_myself"),
        # stretched letters and accents
        ("unaliiiive", "self_harm.unalive"),
        ("kmsssss", "self_harm.kms"),
        ("súïcidé", "self_harm.suicide"),
        # apostrophes left out
        ("dont want to be here anymore", "self_harm.not_be_here"),
    ],
)
def test_evasion_still_matches(text, label):
    verdict = check_transcript(text)
    assert verdict.decision == "held"
    assert verdict.label == label


def test_threat_evasion_still_matches():
    verdict = check_transcript("Im G0NNA K!LL   H1M")
    assert verdict.decision == "blocked"
    assert verdict.label == "threat.kill_person"


@pytest.mark.parametrize(
    "text",
    [
        "this class is killing me",
        "I'm dead tired",
        "I bombed that exam",
        "orgo is going to be the death of me",
        "I could kill for a coffee",
        # near misses the normalizer must not create
        "I ran 5 kms along the river this morning.",
        "At the end, it all worked out.",
        "I don't want to hurt anyone.",
        "This exam will kill me.",
        "Call 988 if you need to talk.",
        "Biked 3kms to class, then 2kms home.",
    ],
)
def test_false_positives_stay_draft(text):
    verdict = check_transcript(text)
    assert verdict.decision == "draft", verdict.label
    assert verdict.label is None


def test_lexicon_version_matches_yaml():
    raw = yaml.safe_load(safety.LEXICON_PATH.read_text(encoding="utf-8"))
    assert check_transcript("hello").lexicon_version == raw["version"] == 1
    assert check_transcript("kms").lexicon_version == raw["version"]


class FakeSession:
    def __init__(self):
        self.added = []
        self.flushed = False
        self.commits = 0
        self.rollbacks = 0

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1

    def add(self, row):
        self.added.append(row)

    async def flush(self):
        self.flushed = True


def patch_insert(monkeypatch):
    calls = []

    async def insert_log(session, note_id, layer, label, decision):
        calls.append((note_id, layer, label, decision))

    monkeypatch.setattr(moderation_repo, "insert_log", insert_log)
    return calls


@pytest.mark.parametrize(
    "text,decision,label",
    [
        ("Walked past Northrop tonight.", "draft", None),
        ("I want to unalive myself", "held", "self_harm.unalive"),
        ("I'm going to shoot up Coffman tomorrow.", "blocked", "threat.attack_place"),
    ],
)
async def test_record_verdict_logs_every_decision(monkeypatch, text, decision, label):
    calls = patch_insert(monkeypatch)
    await record_verdict(FakeSession(), NOTE_ID, check_transcript(text))
    assert calls == [(NOTE_ID, "lexicon.transcript", label, decision)]


async def test_record_verdict_logs_title_checks_separately(monkeypatch):
    calls = patch_insert(monkeypatch)
    await record_verdict(FakeSession(), NOTE_ID, check_transcript("kms"), source="title")
    assert calls == [(NOTE_ID, "lexicon.title", "self_harm.kms", "held")]


async def test_record_verdict_rejects_unknown_source(monkeypatch):
    calls = patch_insert(monkeypatch)
    with pytest.raises(ValueError):
        await record_verdict(FakeSession(), NOTE_ID, check_transcript("hello"), source="body")
    assert calls == []


async def test_record_verdict_never_stores_the_transcript(monkeypatch):
    text = "I want to unalive myself behind Walter"
    calls = patch_insert(monkeypatch)
    await record_verdict(FakeSession(), NOTE_ID, check_transcript(text))
    stored = " ".join(str(value) for value in calls[0])
    assert "unalive myself" not in stored
    assert "walter" not in stored.lower()


async def test_insert_log_writes_only_the_audit_fields():
    session = FakeSession()
    await moderation_repo.insert_log(session, NOTE_ID, "lexicon", "self_harm.kms", "held")
    [row] = session.added
    assert isinstance(row, ModerationLog)
    assert (row.note_id, row.layer, row.label, row.decision) == (NOTE_ID, "lexicon", "self_harm.kms", "held")
    assert session.flushed


def test_check_transcript_import_stays_free_of_the_database():
    code = (
        "import sys; import app.services.safety; "
        "assert not any(m.startswith(('sqlalchemy', 'app.db', 'app.config', 'redis')) for m in sys.modules)"
    )
    subprocess.run([sys.executable, "-c", code], check=True, cwd=Path(__file__).resolve().parent.parent)


def patch_finish_processing(monkeypatch, processing=True):
    changes = []

    async def finish_processing(session, note_id, status):
        if processing:
            changes.append((note_id, status))
        return processing

    monkeypatch.setattr(notes_repo, "finish_processing", finish_processing)
    return changes


@pytest.mark.parametrize(
    "text,decision,label",
    [
        ("Walked past Northrop tonight.", "draft", None),
        ("I want to unalive myself", "held", "self_harm.unalive"),
        ("I'm going to shoot up Coffman tomorrow.", "blocked", "threat.attack_place"),
    ],
)
async def test_apply_transcript_verdict_checks_logs_sets_status_and_commits(
    monkeypatch, text, decision, label
):
    logged = patch_insert(monkeypatch)
    changes = patch_finish_processing(monkeypatch)
    session = FakeSession()
    verdict = await apply_transcript_verdict(session, NOTE_ID, text)
    assert (verdict.decision, verdict.label) == (decision, label)
    assert logged == [(NOTE_ID, "lexicon.transcript", label, decision)]
    assert changes == [(NOTE_ID, decision)]
    assert session.commits == 1


async def test_apply_transcript_verdict_leaves_non_processing_notes_alone(monkeypatch):
    patch_insert(monkeypatch)
    patch_finish_processing(monkeypatch, processing=False)
    session = FakeSession()
    with pytest.raises(safety.NoteNotProcessing):
        await apply_transcript_verdict(session, NOTE_ID, "I want to unalive myself")
    assert session.commits == 0
    assert session.rollbacks == 1

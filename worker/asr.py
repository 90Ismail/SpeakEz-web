"""Speech-to-text: ffmpeg conversion, NeMo Parakeet with word timestamps, and a demo engine.

The real path (ASR_ENGINE=parakeet, the default) runs `nvidia/parakeet-tdt-0.6b-v2`
on a GPU box or Colab. It is imported lazily so the CPU image stays small and
start-up never needs CUDA.

ASR_ENGINE=demo returns a fixed transcript instead. It needs no model, so the
whole upload -> submit -> draft -> publish path can run on a laptop, in CI, or
as a demo-day fallback when no GPU is reachable. Demo mode never skips the
safety gate: the transcript still goes through api/app/services/safety.py, and
set DEMO_TRANSCRIPT to rehearse a held or blocked note (e.g. "I want to unalive
myself").
"""

import os
import shutil
import subprocess
from dataclasses import dataclass, field

DEFAULT_MODEL = "nvidia/parakeet-tdt-0.6b-v2"
PARAKEET_MODEL = os.environ.get("ASR_MODEL", DEFAULT_MODEL)
DEMO_ENGINE_NAMES = {"demo", "stub", "fallback"}
DEFAULT_DEMO_TRANSCRIPT = (
    "I sat on the steps for a while before I said anything out loud. "
    "It has been a long few weeks and I am still here, which counts for something. "
    "If you are reading this, I hope your night is quieter than mine."
)


@dataclass(frozen=True)
class WordTiming:
    word: str
    start_sec: float
    end_sec: float


@dataclass(frozen=True)
class Transcript:
    text: str
    words: list[WordTiming] = field(default_factory=list)
    language: str = "en"


def to_wav_16k_mono(src_path: str, dst_path: str) -> None:
    """Convert phone audio (m4a/AAC/caf) to the 16 kHz mono WAV Parakeet expects."""
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is not installed; add it to the worker image")
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            src_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "wav",
            dst_path,
        ],
        check=True,
        capture_output=True,
    )


_model = None


def _load_model():
    """Load and cache the Parakeet model. Uses CUDA automatically when present."""
    global _model
    if _model is None:
        import nemo.collections.asr as nemo_asr  # imported here so CPU/demo needs no NeMo

        _model = nemo_asr.models.ASRModel.from_pretrained(model_name=PARAKEET_MODEL)
        _model.eval()
    return _model


def load_model():
    """Public alias for `_load_model`. Call it once before judging to pre-warm the weights."""
    return _load_model()


def _word_timings(hypothesis) -> list[WordTiming]:
    stamp = getattr(hypothesis, "timestamp", None)
    if stamp is None:
        stamp = getattr(hypothesis, "timestamps", None)
    if isinstance(stamp, dict):
        raw = stamp.get("word") or []
    elif isinstance(stamp, list):
        raw = stamp
    else:
        raw = []

    words: list[WordTiming] = []
    for item in raw:
        if isinstance(item, dict):
            token = item.get("word") or item.get("text") or ""
            start, end = item.get("start"), item.get("end")
        else:
            token = getattr(item, "word", "") or getattr(item, "text", "")
            start, end = getattr(item, "start", None), getattr(item, "end", None)
        if not token:
            continue
        try:
            words.append(WordTiming(str(token).strip(), float(start), float(end)))
        except (TypeError, ValueError):
            continue
    return words


def _transcribe_parakeet(wav_path: str) -> Transcript:
    model = _load_model()
    output = model.transcribe([wav_path], timestamps=True)
    hypothesis = output[0] if isinstance(output, (list, tuple)) and output else output
    text = getattr(hypothesis, "text", None)
    if text is None and isinstance(hypothesis, str):
        text = hypothesis
    return Transcript(text=(text or "").strip(), words=_word_timings(hypothesis))


def _demo_transcript() -> Transcript:
    text = (os.environ.get("DEMO_TRANSCRIPT") or DEFAULT_DEMO_TRANSCRIPT).strip()
    words: list[WordTiming] = []
    clock = 0.0
    for token in text.split():
        words.append(WordTiming(token, round(clock, 2), round(clock + 0.32, 2)))
        clock += 0.4
    return Transcript(text=text, words=words)


def transcribe(wav_path: str) -> Transcript:
    """Transcribe a 16 kHz mono WAV with word-level timestamps."""
    engine = os.environ.get("ASR_ENGINE", "parakeet").strip().lower()
    if engine in DEMO_ENGINE_NAMES:
        return _demo_transcript()
    if engine == "parakeet":
        return _transcribe_parakeet(wav_path)
    raise ValueError(f"unknown ASR_ENGINE {engine!r}; use 'parakeet' or 'demo'")

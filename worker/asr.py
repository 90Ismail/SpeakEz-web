"""Parakeet TDT 0.6B v2 transcription — interface only.

The real implementation runs on a GPU box (see README.md): ffmpeg converts the
phone's m4a to 16 kHz mono WAV, then NeMo transcribes with word timestamps.
These signatures are what `process_note` will call, so the GPU path can drop in
without touching the job wiring. Until then they raise.
"""

from dataclasses import dataclass, field


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
    """Convert phone audio (m4a/AAC) to the 16 kHz mono WAV Parakeet expects."""
    raise NotImplementedError("ffmpeg conversion lands with the record flow")


def transcribe(wav_path: str) -> Transcript:
    """Transcribe a 16 kHz mono WAV with word-level timestamps."""
    raise NotImplementedError("Parakeet lands with the record flow; see README.md")

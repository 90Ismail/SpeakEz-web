#!/usr/bin/env python3
"""Run the NeMo worker from a Colab (or any) GPU runtime.

Colab has no inbound ports, but it does have outbound internet — which is all the
worker needs. Point it at publicly reachable Redis/Postgres and the deployed API,
then run this file:

    # In Colab, after `git clone <repo> && cd <repo>`:
    !pip -q install -r worker/requirements-gpu.txt
    !pip -q install ./api
    %run deploy/colab_worker.py

Set the variables below (or export them in the environment / Colab secrets)
first. ASR_ENGINE defaults to parakeet; set it to "demo" to rehearse without a
GPU. The process runs in the foreground: stop the cell to leave the queue.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

REQUIRED = ("REDIS_URL", "DATABASE_URL", "API_BASE_URL", "JWT_SECRET", "EMAIL_PEPPER")

DEFAULTS = {
    "ASR_ENGINE": "parakeet",
    "DEMO_MODE": "true",
    "STORAGE_BACKEND": "local",
    "HF_HOME": "/content/models",
}


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    os.chdir(repo_root)

    for key, value in DEFAULTS.items():
        os.environ.setdefault(key, value)

    missing = [key for key in REQUIRED if not os.environ.get(key)]
    if missing:
        print("Missing required environment variables: " + ", ".join(missing), file=sys.stderr)
        print("See deploy/README.md section 2 (Colab).", file=sys.stderr)
        return 2

    if shutil.which("ffmpeg") is None:
        print("ffmpeg not found. In Colab run: !apt-get -qq install -y ffmpeg", file=sys.stderr)
        return 2

    # Keep sys.path pointing at the repo so `worker.main` is importable.
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    print(f"Starting worker: ASR_ENGINE={os.environ['ASR_ENGINE']} API_BASE_URL={os.environ['API_BASE_URL']}")
    return subprocess.call(["arq", "worker.main.WorkerSettings"])


if __name__ == "__main__":
    raise SystemExit(main())

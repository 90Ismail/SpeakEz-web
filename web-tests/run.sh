#!/bin/bash
# Unit tests for the web audio layer (playback fallback + recording upload). Needs Node 20+.
cd "$(dirname "$0")/.." && node --test web-tests/*.test.js

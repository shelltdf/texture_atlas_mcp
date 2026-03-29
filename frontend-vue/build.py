#!/usr/bin/env python3
"""Run production build (npm run build)."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> int:
    if sys.platform == "win32":
        return subprocess.call("npm run build", cwd=ROOT, shell=True)
    return subprocess.call(["npm", "run", "build"], cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())

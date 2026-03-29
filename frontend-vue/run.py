#!/usr/bin/env python3
"""Build then serve dist with vite preview."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> int:
    if sys.platform == "win32":
        r = subprocess.call("npm run build", cwd=ROOT, shell=True)
        if r != 0:
            return r
        return subprocess.call(
            "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
            cwd=ROOT,
            shell=True,
        )
    r = subprocess.call(["npm", "run", "build"], cwd=ROOT)
    if r != 0:
        return r
    return subprocess.call(
        ["npm", "run", "preview", "--", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
        cwd=ROOT,
    )


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Development server (npm run dev)."""
import subprocess
import sys
from pathlib import Path

from deps_check import require_node_modules

ROOT = Path(__file__).resolve().parent


def main() -> int:
    err = require_node_modules()
    if err is not None:
        return err
    if sys.platform == "win32":
        return subprocess.call("npm run dev", cwd=ROOT, shell=True)
    return subprocess.call(["npm", "run", "dev"], cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Build and copy dist/ to publish/."""
import shutil
import subprocess
import sys
from pathlib import Path

from deps_check import require_node_modules

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
OUT = ROOT / "publish"


def main() -> int:
    err = require_node_modules()
    if err is not None:
        return err
    if sys.platform == "win32":
        r = subprocess.call("npm run build", cwd=ROOT, shell=True)
    else:
        r = subprocess.call(["npm", "run", "build"], cwd=ROOT)
    if r != 0:
        return r
    if OUT.exists():
        shutil.rmtree(OUT)
    if not DIST.is_dir():
        print("dist/ missing after build", file=sys.stderr)
        return 1
    shutil.copytree(DIST, OUT)
    print(f"Copied to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

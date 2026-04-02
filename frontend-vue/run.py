#!/usr/bin/env python3
"""Build then serve dist with vite preview.

默认优先使用 4173；若已被占用，Vite 会自动尝试下一可用端口（未传 --strictPort）。
"""
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
        r = subprocess.call("npm run build", cwd=ROOT, shell=True)
        if r != 0:
            return r
        return subprocess.call(
            "npm run preview -- --host 127.0.0.1 --port 4173",
            cwd=ROOT,
            shell=True,
        )
    r = subprocess.call(["npm", "run", "build"], cwd=ROOT)
    if r != 0:
        return r
    return subprocess.call(
        ["npm", "run", "preview", "--", "--host", "127.0.0.1", "--port", "4173"],
        cwd=ROOT,
    )


if __name__ == "__main__":
    raise SystemExit(main())

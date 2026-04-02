#!/usr/bin/env python3
"""Build then serve dist with vite preview.

成功执行 npm run build 后，会校验 dist 产物完整，再启动 vite preview。
默认端口 **4174**（与 VS Code 扩展 `textureAtlas.previewPort` 一致），避免与占用 **4173** 的其他 Vite 项目混淆。
环境变量 TEXTURE_ATLAS_PREVIEW_PORT 可覆盖端口；使用 --strictPort，端口被占用时会失败而非静默换端口。
"""
import os
import subprocess
import sys
from pathlib import Path

from deps_check import require_node_modules, verify_frontend_dist

ROOT = Path(__file__).resolve().parent
PREVIEW_PORT = int(os.environ.get("TEXTURE_ATLAS_PREVIEW_PORT", "4174"))


def main() -> int:
    err = require_node_modules()
    if err is not None:
        return err
    if sys.platform == "win32":
        r = subprocess.call("npm run build", cwd=ROOT, shell=True)
        if r != 0:
            return r
    else:
        r = subprocess.call(["npm", "run", "build"], cwd=ROOT)
        if r != 0:
            return r
    err = verify_frontend_dist(ROOT)
    if err is not None:
        return err
    pv = str(PREVIEW_PORT)
    if sys.platform == "win32":
        return subprocess.call(
            f"npm run preview -- --host 127.0.0.1 --port {pv} --strictPort",
            cwd=ROOT,
            shell=True,
        )
    return subprocess.call(
        [
            "npm",
            "run",
            "preview",
            "--",
            "--host",
            "127.0.0.1",
            "--port",
            pv,
            "--strictPort",
        ],
        cwd=ROOT,
    )


if __name__ == "__main__":
    raise SystemExit(main())

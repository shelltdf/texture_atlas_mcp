"""在运行 npm 脚本前检查 node_modules 是否存在；在校验 dist 产物是否完整。"""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent


def require_node_modules() -> int | None:
    if (_ROOT / "node_modules").is_dir():
        return None
    print(
        "错误：未找到 node_modules。请在 frontend-vue 目录执行: npm install",
        file=sys.stderr,
    )
    return 1


def verify_frontend_dist(root: Path | None = None) -> int | None:
    """
    确认 `npm run build` / `npm run test` 后的 Vite 产物存在且结构合理。
    若返回非 None，表示编译结果不可用（不应启动预览/Electron/继续安装流程）。
    """
    base = root if root is not None else _ROOT
    dist = base / "dist"
    index = dist / "index.html"
    if not index.is_file():
        print(
            "错误：未找到 dist/index.html，前端构建不完整或未执行成功。",
            file=sys.stderr,
        )
        return 1
    assets = dist / "assets"
    if not assets.is_dir():
        print("错误：未找到 dist/assets，前端构建不完整。", file=sys.stderr)
        return 1
    if not any(assets.glob("*.js")):
        print("错误：dist/assets 下缺少 .js 产物。", file=sys.stderr)
        return 1
    if not any(assets.glob("*.css")):
        print("错误：dist/assets 下缺少 .css 产物。", file=sys.stderr)
        return 1
    return None

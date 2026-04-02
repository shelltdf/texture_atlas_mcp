"""在运行 npm 脚本前检查 node_modules 是否存在。"""
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

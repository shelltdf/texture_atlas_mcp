"""在运行 npm 脚本前检查 node_modules 是否存在；在校验 dist 产物是否完整。"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent


def require_node_modules() -> int | None:
    """仅检查，不自动安装。"""
    return ensure_node_modules(_ROOT, auto_install=False)


def ensure_node_modules(root: Path | None = None, *, auto_install: bool = False) -> int | None:
    """
    确保 ``<root>/node_modules`` 存在。
    ``auto_install=True`` 时若缺失则在该目录执行 ``npm install``（需 PATH 中有 npm）。
    """
    base = root if root is not None else _ROOT
    nm = base / "node_modules"
    if nm.is_dir():
        return None
    pkg = base / "package.json"
    if not pkg.is_file():
        print(f"错误：{base} 下缺少 package.json。", file=sys.stderr)
        return 1
    if not auto_install:
        print(
            f"错误：未找到 {nm.resolve()}。\n"
            f"请在该目录执行: cd {base.resolve()} && npm install",
            file=sys.stderr,
        )
        return 1
    if not shutil.which("npm"):
        print(
            "错误：未找到 npm，无法自动安装依赖。请安装 Node.js LTS 并确保 npm 在 PATH 中。",
            file=sys.stderr,
        )
        return 1
    print(f"未检测到 node_modules，正在 {base.resolve()} 执行 npm install …")
    if sys.platform == "win32":
        r = subprocess.call("npm install", cwd=base, shell=True)
    else:
        r = subprocess.call(["npm", "install"], cwd=base)
    if r != 0:
        print("错误：npm install 失败。", file=sys.stderr)
        return r
    if not nm.is_dir():
        print(f"错误：npm install 后仍未出现 {nm}。", file=sys.stderr)
        return 1
    print("npm install 完成。")
    return None


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

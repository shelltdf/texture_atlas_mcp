#!/usr/bin/env python3
"""生产构建与「全套建造」流程。

无参数：依次 **npm run build**（前端 dist）+ **打包 VSIX**（`vsix/<扩展名>-<版本>.vsix`，勿放 dist——Vite 会清空 dist）+ **install.py**（mcp-server 依赖、VS Code/Cursor 扩展、MCP 配置）。

`npm run build` 成功后由本脚本调用 `node scripts/package-vsix.mjs`；单独打包扩展可执行 `npm run package:vsix`。

Electron 桌面 **exe**（electron-builder，`release/win-unpacked/` 下主程序，见 `package.json` 的 `build`）：`npm run package:electron`（需先有 `dist/`）或一键 `npm run package:exe`（先 build 再打包）。

可选仅执行其中一步或启动预览/套壳（与完整流程互斥）：
  python build.py --dist-only   # 仅 npm run build
  python build.py --web           # 构建后 vite preview
  python build.py --electron      # 构建后 Electron
  python build.py --electron-exe  # 构建 + VSIX + Electron 打包（release/），不跑 install.py

install.py 的额外参数请单独执行: python install.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from deps_check import require_node_modules

ROOT = Path(__file__).resolve().parent
INSTALL_PY = ROOT / "install.py"


def _npm_build() -> int:
    if sys.platform == "win32":
        return subprocess.call("npm run build", cwd=ROOT, shell=True)
    return subprocess.call(["npm", "run", "build"], cwd=ROOT)


def _package_vsix() -> int:
    """vscode-extension → vsix/<name>-<version>.vsix（与 npm run package:vsix 相同）。"""
    script = ROOT / "scripts" / "package-vsix.mjs"
    return subprocess.call(["node", str(script)], cwd=ROOT)


def _package_electron() -> int:
    """electron-builder → release/（与 npm run package:electron 相同）。"""
    if sys.platform == "win32":
        return subprocess.call("npm run package:electron", cwd=ROOT, shell=True)
    return subprocess.call(["npm", "run", "package:electron"], cwd=ROOT)


def _after_web() -> int:
    pv = os.environ.get("TEXTURE_ATLAS_PREVIEW_PORT", "4174")
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


def _after_electron() -> int:
    if sys.platform == "win32":
        return subprocess.call("npm run electron", cwd=ROOT, shell=True)
    return subprocess.call(["npm", "run", "electron"], cwd=ROOT)


def _after_install() -> int:
    return subprocess.call([sys.executable, str(INSTALL_PY)], cwd=ROOT)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="无参数 = 完整建造（dist + VSIX + install.py）；可用 --dist-only / --web / --electron / --electron-exe 仅执行片段",
    )
    g = ap.add_mutually_exclusive_group()
    g.add_argument(
        "--dist-only",
        action="store_true",
        help="仅 npm run build（不执行 install.py）",
    )
    g.add_argument(
        "--web",
        action="store_true",
        help="构建成功后：vite preview（默认 127.0.0.1:4174，与扩展一致）；不跑 install.py",
    )
    g.add_argument(
        "--electron",
        action="store_true",
        help="构建成功后：Electron；不跑 install.py",
    )
    g.add_argument(
        "--electron-exe",
        action="store_true",
        help="构建 + VSIX + electron-builder（release/）；不跑 install.py",
    )
    args = ap.parse_args()

    err = require_node_modules()
    if err is not None:
        return err

    r = _npm_build()
    if r != 0:
        return r

    r = _package_vsix()
    if r != 0:
        return r

    if args.dist_only:
        return 0
    if args.web:
        return _after_web()
    if args.electron:
        return _after_electron()
    if args.electron_exe:
        return _package_electron()

    # 无互斥参数：完整建造 = 构建 + 扩展/MCP 安装脚本
    return _after_install()


if __name__ == "__main__":
    raise SystemExit(main())

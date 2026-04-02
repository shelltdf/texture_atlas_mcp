#!/usr/bin/env python3
"""
将 vscode-extension 安装到本机 VS Code / Cursor 扩展目录；
安装 mcp-server 依赖，并在仓库根目录写入/合并 .cursor/mcp.json（MCP 键名 **TextureAtlas**）。

安装位置（默认同时装两处）:
  Windows: %USERPROFILE%\\.vscode\\extensions\\<publisher>.<name>-<version>
           %USERPROFILE%\\.cursor\\extensions\\<publisher>.<name>-<version>
  默认会先执行 ``npm run test``（``vue-tsc`` + ``vite build``，**不 bump 版本号**）并校验 ``dist/`` 产物，再装扩展/MCP。
  若扩展列表里看不到：先完全退出并重启 Cursor/VS Code，或命令面板执行「Developer: Reload Window」。

说明：即使 mcp-server 的 npm install 失败，仍会尝试复制扩展（旧版脚本会在 npm 失败时直接退出导致「扩展没装上」）。

Cursor 扩展视图有时不显示「仅复制到 extensions 目录」的扩展；脚本会在复制后尽量打 .vsix（输出到 ``frontend-vue/vsix/<name>-<version>.vsix``，**不放 dist/**，否则下次 Vite 构建会清空）并执行
``cursor`` / ``code --install-extension`` 安装该文件，以便在扩展列表里可见（需本机 PATH 能找到 cursor/code）。

用法:
  python install.py
  python install.py --vscode-only
  python install.py --cursor-only
  python install.py --dry-run
  python install.py --skip-vsix-register   # 不打包 .vsix、不用 CLI 注册（仅复制目录）
  python install.py --skip-frontend-build  # 不跑 npm run test / 不校验 dist（仅当你已手动构建过时）
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from deps_check import require_node_modules, verify_frontend_dist

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent
EXT_SRC = ROOT / "vscode-extension"
MCP_DIR = ROOT / "mcp-server"
SERVER_JS = MCP_DIR / "server.mjs"
RUN_WEB = ROOT / "run_web.py"


def _extensions_vscode() -> Path:
    return Path.home() / ".vscode" / "extensions"


def _extensions_cursor() -> Path:
    return Path.home() / ".cursor" / "extensions"


def _ext_folder_name() -> str:
    pkg = json.loads((EXT_SRC / "package.json").read_text(encoding="utf-8"))
    pub = pkg.get("publisher", "local")
    name = pkg.get("name", "texture-atlas-editor")
    ver = pkg.get("version", "0.0.1")
    return f"{pub}.{name}-{ver}"


def _vsix_path() -> Path:
    pkg = json.loads((EXT_SRC / "package.json").read_text(encoding="utf-8"))
    name = pkg.get("name", "texture-atlas-editor")
    ver = pkg.get("version", "0.0.1")
    return ROOT / "vsix" / f"{name}-{ver}.vsix"


def _package_vsix(dry: bool) -> Path | None:
    """调用 node scripts/package-vsix.mjs，返回生成的 .vsix 路径；失败返回 None。"""
    script = ROOT / "scripts" / "package-vsix.mjs"
    if not script.is_file():
        print("提示：未找到 scripts/package-vsix.mjs，跳过 .vsix 打包。", file=sys.stderr)
        return None
    if dry:
        print(f"[dry-run] node {script} -> {_vsix_path()}")
        return _vsix_path()
    node = shutil.which("node")
    if not node:
        print("提示：未找到 node，跳过 .vsix 打包与 CLI 注册。", file=sys.stderr)
        return None
    r = subprocess.call([node, str(script)], cwd=ROOT)
    if r != 0:
        print("警告：package-vsix 失败（可检查网络与 npx/vsce）。扩展目录已复制，可手动「从 VSIX 安装」。", file=sys.stderr)
        return None
    out = _vsix_path()
    return out if out.is_file() else None


def _install_vsix_with_cli(vsix: Path, *, do_cursor: bool, do_vscode: bool, dry: bool) -> None:
    """通过官方 CLI 安装 .vsix，扩展面板才能稳定显示（尤其 Cursor）。"""
    if dry:
        if do_cursor and shutil.which("cursor"):
            print(f"[dry-run] cursor --install-extension {vsix}")
        if do_vscode and shutil.which("code"):
            print(f"[dry-run] code --install-extension {vsix}")
        return
    if not vsix.is_file():
        print(
            f"提示：未找到 {vsix}，跳过 CLI 安装。可在扩展视图 ⋮ → Install from VSIX 手动选择该文件。",
            file=sys.stderr,
        )
        return
    any_ok = False
    if do_cursor:
        exe = shutil.which("cursor")
        if exe:
            r = subprocess.call([exe, "--install-extension", str(vsix)])
            if r == 0:
                print("已通过 cursor CLI 注册扩展（Cursor 扩展列表应可搜到 Texture Atlas）。")
                any_ok = True
            else:
                print(f"警告：cursor --install-extension 退出码 {r}", file=sys.stderr)
        else:
            print("提示：PATH 中未找到 cursor，请手动：Cursor → 扩展 → ⋮ → Install from VSIX", file=sys.stderr)
    if do_vscode:
        exe = shutil.which("code")
        if exe:
            r = subprocess.call([exe, "--install-extension", str(vsix)])
            if r == 0:
                print("已通过 code CLI 注册扩展（VS Code 扩展列表应可搜到）。")
                any_ok = True
            else:
                print(f"警告：code --install-extension 退出码 {r}", file=sys.stderr)
        else:
            print("提示：PATH 中未找到 code（VS Code CLI），可跳过或从 VS Code 安装「Shell 命令」。")
    if not any_ok and (do_cursor or do_vscode):
        print(
            f"手动安装：扩展视图右上角 ⋮ → Install from VSIX → 选择：{vsix.resolve()}",
        )


def _npm_install_mcp(dry: bool) -> int:
    if not MCP_DIR.is_dir():
        print("错误：未找到 mcp-server 目录", file=sys.stderr)
        return 1
    if dry:
        print(f"[dry-run] npm install (cwd={MCP_DIR})")
        return 0
    if sys.platform == "win32":
        return subprocess.call("npm install", cwd=MCP_DIR, shell=True)
    return subprocess.call(["npm", "install"], cwd=MCP_DIR)


def _copy_extension(dst: Path, dry: bool) -> None:
    name = _ext_folder_name()
    target = dst / name
    if dry:
        print(f"[dry-run] shutil.copytree {EXT_SRC} -> {target}")
        return
    # 首次安装时用户可能从未打开过 VS Code/Cursor，extensions 父目录不存在会导致 copytree 失败
    dst.mkdir(parents=True, exist_ok=True)
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(EXT_SRC, target)
    paths = {
        "repoRoot": str(REPO_ROOT.resolve()),
        "frontendVue": str(ROOT.resolve()),
        "mcpServer": str(SERVER_JS.resolve()),
        "runWeb": str(RUN_WEB.resolve()),
    }
    (target / "install-paths.json").write_text(
        json.dumps(paths, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"已安装扩展: {target}")


def _merge_mcp_json(dry: bool) -> None:
    cursor_dir = REPO_ROOT / ".cursor"
    mcp_path = cursor_dir / "mcp.json"
    server = SERVER_JS.resolve()
    node = shutil.which("node")
    if not node:
        print("警告：未在 PATH 中找到 node，已跳过写入 mcp.json", file=sys.stderr)
        return
    entry = {
        "command": node,
        "args": [str(server)],
        "cwd": str(MCP_DIR.resolve()),
    }
    if dry:
        print(f"[dry-run] merge mcp.json -> {mcp_path}")
        print(json.dumps({"mcpServers": {"TextureAtlas": entry}}, indent=2))
        return
    cursor_dir.mkdir(parents=True, exist_ok=True)
    data: dict = {}
    if mcp_path.exists():
        try:
            data = json.loads(mcp_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"警告：无法解析 {mcp_path}，将覆盖为仅含 TextureAtlas", file=sys.stderr)
            data = {}
    if "mcpServers" not in data or not isinstance(data["mcpServers"], dict):
        data["mcpServers"] = {}
    servers = data["mcpServers"]
    for old_key in ("texture-atlas", "texture_atlas_mcp"):
        servers.pop(old_key, None)
    servers["TextureAtlas"] = entry
    mcp_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"已写入 MCP 配置: {mcp_path}")


def main() -> int:
    ap = argparse.ArgumentParser(description="安装 VS Code/Cursor 扩展并配置 MCP")
    ap.add_argument("--vscode-only", action="store_true", help="仅安装到 VS Code")
    ap.add_argument("--cursor-only", action="store_true", help="仅安装到 Cursor")
    ap.add_argument("--skip-mcp", action="store_true", help="不写入 .cursor/mcp.json")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--skip-vsix-register",
        action="store_true",
        help="不执行 package-vsix 与 cursor/code --install-extension（仅复制扩展目录）",
    )
    ap.add_argument(
        "--skip-frontend-build",
        action="store_true",
        help="不执行 npm run test 与 dist 校验（仅扩展/MCP；请自行保证 dist 已构建）",
    )
    args = ap.parse_args()

    if not EXT_SRC.is_dir():
        print("错误：未找到 vscode-extension 目录", file=sys.stderr)
        return 1

    if args.vscode_only and args.cursor_only:
        print("错误：不能同时指定 --vscode-only 与 --cursor-only", file=sys.stderr)
        return 1

    if args.dry_run:
        if not args.skip_frontend_build:
            print("[dry-run] npm run test + verify_frontend_dist(dist/index.html, dist/assets/*.js,*.css)")
    elif args.skip_frontend_build:
        print("提示：已跳过前端编译校验（--skip-frontend-build）。", file=sys.stderr)
    else:
        err = require_node_modules()
        if err is not None:
            return err
        if sys.platform == "win32":
            r = subprocess.call("npm run test", cwd=ROOT, shell=True)
        else:
            r = subprocess.call(["npm", "run", "test"], cwd=ROOT)
        if r != 0:
            print(
                "错误：npm run test 失败（类型检查或 Vite 构建未通过），已中止安装。",
                file=sys.stderr,
            )
            return r
        err = verify_frontend_dist(ROOT)
        if err is not None:
            return err
        print("已确认 frontend-vue 编译产物 dist/ 可用。")

    if args.vscode_only:
        do_vscode, do_cursor = True, False
    elif args.cursor_only:
        do_vscode, do_cursor = False, True
    else:
        do_vscode, do_cursor = True, True

    r = _npm_install_mcp(args.dry_run)
    if r != 0:
        print(
            "警告：mcp-server 的 npm install 失败（无网络、未装 Node/npm 等）。"
            "扩展仍会复制到编辑器目录；仅 MCP 功能可能不可用。",
            file=sys.stderr,
        )

    if do_vscode:
        _copy_extension(_extensions_vscode(), args.dry_run)
    if do_cursor:
        _copy_extension(_extensions_cursor(), args.dry_run)

    if not args.skip_vsix_register:
        vsix = _package_vsix(args.dry_run)
        if vsix:
            _install_vsix_with_cli(
                vsix,
                do_cursor=do_cursor,
                do_vscode=do_vscode,
                dry=args.dry_run,
            )

    if not args.skip_mcp:
        _merge_mcp_json(args.dry_run)

    if not args.dry_run:
        print("")
        print("下一步：重启 VS Code / Cursor，在命令面板执行「Texture Atlas」相关命令。")
        print("Cursor：确认 MCP 中已启用 TextureAtlas（设置 → MCP）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

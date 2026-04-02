# texture-atlas-editor-spa

## 产物

- **类型**：静态站点（HTML/JS/CSS），由 Vite `build` 输出至 `frontend-vue/dist/`。
- **入口**：`frontend-vue/index.html` → `src/main.ts` → `App.vue`。

## 源码根

`frontend-vue/`（仓库根下子目录）。

## 与构建目标对应

- **npm**：`npm run build` → `dist/`
- **开发**：`npm run dev`（见 `frontend-vue/dev.py`）
- **VS Code / Cursor 扩展**：`npm run package:vsix` 前会同步 `dist/` → `vscode-extension/dist/`；扩展清单与宿主逻辑见 `../vscode-extension/`（`extension.cjs`、`package.json`）。

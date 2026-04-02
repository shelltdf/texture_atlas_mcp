# 开发维护说明书

## 仓库结构

- `ai-software-engineering/`：四阶段工程文档（AI 维护）。
- `frontend-vue/`：Vue 3 + Vite 实现（**不在**文档目录内）。

## 依赖

- Node.js 与 npm（建议 LTS）。
- **首次或克隆后**在 `frontend-vue` 下执行 `npm install`（生成 `node_modules`，否则 `vue-tsc` / `vite` 不可用）。若未安装，运行 `build.py` / `run.py` 等会先提示执行 `npm install`。

## 脚本（Python 封装，位于 `frontend-vue/`）

| 脚本 | 行为 |
|------|------|
| `build.py` | `npm run build` |
| `test.py` | 类型检查 + 构建（冒烟） |
| `run.py` | 构建后 `vite preview`（默认 `127.0.0.1:4173`；端口占用时 Vite 自动换端口，终端会打印实际地址） |
| `dev.py` | `npm run dev` |
| `publish.py` | 构建并将 `dist` 复制到 `frontend-vue/publish/` |

## 发布

- 将 `dist/` 或 `publish/` 内容部署到静态托管即可。

## 与物理规格、映射

- 对外行为与数据字段以 `ai-software-engineering/02-physical/texture-atlas-editor-spa/spec.md` 为准。
- 主要 UI ↔ 源码路径见同目录 `mapping.md`；`atlasStore` 画布相关字段亦列于该文件。

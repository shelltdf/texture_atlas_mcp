# 开发维护说明书

## 仓库结构

- `ai-software-engineering/`：四阶段工程文档（AI 维护）。
- `frontend-vue/`：Vue 3 + Vite 实现（**不在**文档目录内）。

## 依赖

- Node.js 与 npm（建议 LTS）。
- 在 `frontend-vue` 下执行 `npm install`。

## 脚本（Python 封装，位于 `frontend-vue/`）

| 脚本 | 行为 |
|------|------|
| `build.py` | `npm run build` |
| `test.py` | 类型检查 + 构建（冒烟） |
| `run.py` | 构建后 `vite preview` |
| `dev.py` | `npm run dev` |
| `publish.py` | 构建并将 `dist` 复制到 `frontend-vue/publish/` |

## 发布

- 将 `dist/` 或 `publish/` 内容部署到静态托管即可。

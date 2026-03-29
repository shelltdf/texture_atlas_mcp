# Texture Atlas 编辑器（Vue 3 + Vite）

浏览器内纹理图集编辑：导入图片、选择打包算法、预览画布、导出 `atlas.json` + `atlas.png`、逆向拆分。

## 依赖

- Node.js LTS、npm

## 命令

- `npm install`：安装依赖
- `npm run dev`：开发服务器
- `npm run build`：生产构建 → `dist/`
- `npm run preview`：预览构建结果
- `npm run test`：类型检查 + 构建（冒烟）

## Python 封装

同目录下 `build.py`、`test.py`、`run.py`、`dev.py`、`publish.py` 封装上述 npm 命令（Windows 下使用 `shell=True` 调用 npm）。

## 文档

四阶段说明见仓库根目录 `ai-software-engineering/`。

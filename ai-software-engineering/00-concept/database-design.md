# 数据库 / 存储设计

本工具以浏览器端为主，无服务端数据库。

## 浏览器内状态

- **图片条目**：名称、自然宽高、Object URL 或 Image 引用、可选缩略图 Data URL。
- **打包结果**：画布宽高、各精灵的轴对齐矩形（像素坐标）、与源条目 id 映射。

## 持久化

- **导出**：用户通过下载获得 `atlas.png`（或用户指定名）与 `atlas.json`（清单）。
- **逆向输入**：用户选取已导出的 PNG + JSON，不写入本地数据库。

## 清单文件（逻辑模型）

见 `interface-design.md` 中 JSON Schema 描述；物理字段级规格见 `02-physical/texture-atlas-editor-spa/spec.md`。

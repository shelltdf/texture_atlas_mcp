# 物理规格：texture-atlas-editor-spa

## 清单 JSON（version 1）

| 字段 | 类型 | 说明 |
|------|------|------|
| version | number | 固定 `1` |
| width | number | 图集宽，正整数 |
| height | number | 图集高，正整数 |
| sprites | array | 精灵列表 |
| sprites[].id | string | 唯一 id |
| sprites[].name | string | 显示名/文件名 |
| sprites[].x | number | 左上角 x |
| sprites[].y | number | 左上角 y |
| sprites[].w | number | 宽 |
| sprites[].h | number | 高 |

## 打包算法 ID

| id | 说明 |
|----|------|
| `grid` | 网格：列数 `ceil(sqrt(n))`，按顺序填充，单元尺寸为该行/列最大边 |
| `rows` | 按行贪心：从左到右，超出最大宽度则换行 |
| `skyline` | 天际线简化：从左到右找最低可用 y 放置 |

## 单张图集尺寸上限（用户可配）

- **单张最大宽**、**单张最大高**（像素）：分别约束单张图集的宽与高；合法范围各 `64`～`16384`，默认均为 `4096`；在 UI 中于「打包算法」**上方**分两栏输入。
- 若当前算法在**单张**内无法排下全部图片，则自动拆成**多张图集**（多页）；**画布标题栏**显示页码与当前页输出边界尺寸，并提供翻页与**全部总览**。
- 任一张素材自身宽或高大于对应上限时，打包报错，需提高上限或缩小素材。
- **画布预览**：在每张图集左上角对齐绘制 **maxW×maxH** 的紫色示意外框（与设置一致）；橙色为当前页实际输出边界。**预览用画布尺寸**在逻辑内容 `max(当前页输出, maxW)×max(当前页输出, maxH)`（+1px）之外再留 **bleed 边距**（随线宽/选中框外扩计算），使描边一半线宽与金色选中框不被 canvas 位图边缘裁切；导出 PNG 仍以实际输出为准。
- **辅助线（分项开关，默认全开）**：`canvasHelperShowGrid`（灰网格）、`canvasHelperShowMaxBounds`（紫单张上限）、`canvasHelperShowOutputBounds`（橙当前页输出）、`canvasHelperShowSpriteBounds`（青/黑图块描边）。另可调 `canvasHelperStrokePx`（纹理像素，**1～128**）、`canvasHelperGridStep`（**8～512**，步进 8）。
- **线宽默认值同步**：`canvasHelperStrokePx` 初始为 `max(1, round(DEFAULT_MAX_ATLAS_EDGE/256))`。用户修改「单张最大宽/高」并写入 store 时，若数值相对原值有变化，则按 `max(1, round(max(maxW,maxH)/256))` 重算线宽。执行「运行打包」时，仅当 `clampBounds` 修正后的宽/高与打包前不一致时再次同步；**上限未变则保留用户手调线宽**。
- **选中对象金框**（`selectedId`）：不计入上述辅助线开关，有选中即绘制。**双击列表项**在 `ImageThumbnails.vue` 中打开**原图全尺寸预览**（`objectUrl`），不再驱动画布平移。

## 打包图集面板（侧栏 `AtlasPanel.vue`）

- 标题为「打包图集」；包含单张最大宽/高、打包算法与 **运行打包**。
- **不包含**「导入图集」「导出图集」「逆向拆分」按钮；上述命令由**菜单「文件」**与**工具栏**提供（均先经格式选择再选文件）。

## 导出

- UI **导出图集**须先选择产物类型：`png+json`（默认）、`png-only`、`json-only`；避免与「仅 JSON」类混淆。
- PNG：与清单 `width`×`height` 一致，**RGBA 透明底**（未占用像素 alpha=0），精灵按清单矩形从源图绘制（保留素材 alpha）。
- **单页**：`atlas.png`、`atlas.json`（在 `png+json` 模式下）。
- **多页**：`atlas-00.png` / `atlas-00.json`、`atlas-01.*` …（两位序号，**从 0 起**与页码一致）；各页清单仅描述该页内精灵。

## 导入图集到列表

- **导入图集**（与「逆向拆分」区分）：在确认格式为「本应用 v1：JSON + PNG」后，按清单裁切子图并 **加入左侧图片列表**（`importAtlasIntoList`），不触发浏览器批量下载子图。

## 逆向

- 输入：清单 + 同尺寸 PNG。
- 校验：`image.naturalWidth === width && image.naturalHeight === height`，否则报错。
- 输出：每张精灵触发下载，文件名 `name` 净化后 + `.png`。

## 退出码（CLI 脚本）

- Python 包装脚本：`build.py`/`test.py` 以进程退出码 0 表示成功，非 0 表示失败（见 `03-ops`）。

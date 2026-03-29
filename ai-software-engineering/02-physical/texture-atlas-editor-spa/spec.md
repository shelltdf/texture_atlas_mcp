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

- **单张最大边长**（像素）：同时约束单张图集的宽与高；合法范围 `64`～`16384`，默认 `4096`；在 UI 中于「打包算法」选择框**上方**输入。
- 若当前算法在**单张**内无法排下全部图片，则自动拆成**多张图集**（多页）；**画布标题栏**显示页码与当前页输出边界尺寸，并提供翻页与**全部总览**（竖向总排版画布，含各页输出边界框与图块边界预览）。
- 任一张素材自身宽或高大于该上限时，打包报错，需提高上限或缩小素材。

## 导出

- PNG：与清单 `width`×`height` 一致，RGBA，精灵按清单矩形从源图绘制。
- **单页**：`atlas.png`、`atlas.json`。
- **多页**：`atlas-00.png` / `atlas-00.json`、`atlas-01.*` …（两位序号，**从 0 起**与页码一致）；各页清单仅描述该页内精灵。

## 逆向

- 输入：清单 + 同尺寸 PNG。
- 校验：`image.naturalWidth === width && image.naturalHeight === height`，否则报错。
- 输出：每张精灵触发下载，文件名 `name` 净化后 + `.png`。

## 退出码（CLI 脚本）

- Python 包装脚本：`build.py`/`test.py` 以进程退出码 0 表示成功，非 0 表示失败（见 `03-ops`）。

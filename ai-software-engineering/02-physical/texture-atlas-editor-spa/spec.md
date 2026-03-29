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

## 画布约束

- 最大边长默认 `4096`（常量，可在实现中调整）；超出时打包失败并提示。

## 导出

- PNG：与清单 `width`×`height` 一致，RGBA，精灵按清单矩形从源图绘制。
- 文件名默认：`atlas.png`、`atlas.json`。

## 逆向

- 输入：清单 + 同尺寸 PNG。
- 校验：`image.naturalWidth === width && image.naturalHeight === height`，否则报错。
- 输出：每张精灵触发下载，文件名 `name` 净化后 + `.png`。

## 退出码（CLI 脚本）

- Python 包装脚本：`build.py`/`test.py` 以进程退出码 0 表示成功，非 0 表示失败（见 `03-ops`）。

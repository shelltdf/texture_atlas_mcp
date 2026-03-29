# 软件设计

## 子系统

1. **壳层 UI**：菜单栏、工具栏、状态栏、分割 Dock 与画布，采用 Windows 视觉隐喻（Segoe UI、灰阶边框、立体分割线）。
2. **资源管理**：用户选取的本地图片列表、选中态、缩略图生成（Canvas 或 Object URL）。
3. **打包引擎**：可插拔算法，输入为尺寸列表，输出为放置矩形与画布大小。
4. **导出/逆向**：将布局序列化为 JSON，将合并画布渲染为 PNG；逆向按矩形从源图裁剪。

## 与实现对应

- 实现子项目位于仓库根目录 `frontend-vue/`（Vite + Vue 3 + TypeScript）。
- 应用状态集中在 `frontend-vue/src/stores/atlasStore.ts`（`reactive`），画布预览与辅助线分项开关、打包结果、导出/逆向入口均经该 store 与组件协作完成。

## 依赖

- 运行时：Vue 3。
- 构建：Vite、TypeScript、vue-tsc。

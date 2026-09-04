# 更新日志

本项目的重要变更都会记录在此文件中。版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-09-04

### 新增

- 扫描引用同页 sprite 的内嵌 SVG，自动内联被引用图形，使其可以正常预览和下载。
- 扫描品牌与导航节点上的 CSS `background-image` Logo。
- 穿透开放 shadow root，覆盖 Web Components 内的 Logo 与图标。

### 修复

- 修复 1 秒内连续点击「复制」时，按钮文案永久停留在「已复制」的问题。
- 默认 `/favicon.ico` 改为相对站点根目录解析，不再受页面 `<base href>` 影响。
- 内嵌 SVG 编号不再因跳过项而出现跳号。

## [0.0.1] - 2026-08-03

### 新增

- 扫描常见网页 Logo 图片、内嵌 SVG 与 Schema.org 结构化图片。
- 发现 Open Graph、Twitter Card、Favicon、Apple Touch Icon、Mask Icon 和 Web App Manifest 图标。
- 提供全部、Logo、Favicon 三种结果筛选方式。
- 支持资源预览、复制链接、复制当前列表、单项下载和批量下载。
- 提供重新扫描、错误提示和 Chrome 受保护页面提示。
- 提供关于页面、隐私政策与完整使用指南。
- 所有提取和分类逻辑在本地运行，不上传浏览记录或扫描结果。

[0.1.0]: https://github.com/everett7623/LogoLens/releases/tag/v0.1.0
[0.0.1]: https://github.com/everett7623/LogoLens/releases/tag/v0.0.1

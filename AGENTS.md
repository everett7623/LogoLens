# Repository Guidelines

完整开发规范见 [CLAUDE.md](CLAUDE.md)。本文件只保留最小必要信息，避免两处描述漂移；两者冲突时以 CLAUDE.md 为准。

## 项目性质

LogoLens 是零依赖的 Chrome Manifest V3 扩展，采用扁平目录结构和原生 HTML/CSS/JavaScript。`manifest.json` 定义权限、图标、popup 与 About 页；`popup.html`/`popup.css`/`popup.js` 实现界面与内存状态；`extractor.js` 提供被注入的 `extractAssets()`；`options.html` 与 `privacy.html` 复用 popup 样式。没有后端、包管理器、构建步骤、linter 或测试框架。

除非仓库明确采纳，否则不要引入 npm 工作流。

## 校验与验证

```bash
node --check extractor.js
node --check popup.js
# PowerShell 下把 /dev/null 换成 $null
python -m json.tool manifest.json > /dev/null
```

功能验证走 Chrome 未打包扩展流程：打开 `chrome://extensions/`，开启开发者模式，选择「加载已解压的扩展程序」并选中仓库根目录。改动后在扩展卡片点击「重新加载」并重开 popup，仅刷新网页不会重载扩展代码。

行为变更后需在真实 HTTP(S) 页面手工验证：首次与重复扫描、`all`/`logo`/`favicon` 筛选、单项与批量复制下载、内嵌 SVG 预览、Web App Manifest 图标，以及 Chrome 内部页面的错误提示。改动共享 CSS 后需检查 popup、About 与隐私三个视图。

## 代码风格

HTML、CSS、JavaScript 和 JSON 统一两空格缩进。JavaScript 沿用双引号、分号、`camelCase` 函数与变量、`UPPER_SNAKE_CASE` 上限常量；CSS class 用语义化 kebab-case。`popup.js` 中的 DOM selector 必须与 `popup.html` 的 ID、class 和卡片 template 保持同步。`extractAssets()` 必须自包含，返回值必须能被 `chrome.scripting.executeScript()` 结构化克隆。

界面文案与扫描器产出的 label 使用简体中文，技术名词保留英文原文。

## 提交与 PR

使用中文 Conventional Commits，例如 `fix: 修复内嵌 SVG 预览空白`。PR 需说明用户可见的变化，列出手工验证过的页面与结果，关联相关 issue，UI 改动附截图，并单独指出任何权限或数据处理变更。

## 安全与发布

权限保持最小化，提取逻辑保持本地执行。涉及权限、安装步骤或数据处理的改动，必须同步更新 `README.md`、`docs/USAGE.md`、`PRIVACY.md` 和 `privacy.html`。发布时同步 `manifest.json`、`options.html`、`README.md`、`docs/USAGE.md` 中的版本号并追加 `CHANGELOG.md` 条目，保留 manifest 引用的全部图标尺寸。

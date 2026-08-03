# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目与开发流程

LogoLens 是零依赖的 Chrome Manifest V3 扩展：使用原生 HTML、CSS、JavaScript 和静态 PNG 图标，从当前活动网页中提取 logo、favicon、SVG、社交图片和 Web App Manifest 图标。没有后端、包管理器、构建工具、linter、测试框架或 CI 配置。

本仓库没有可运行的 `build`、`lint`、`test` 或单测命令；不要臆造 `npm`、`pnpm` 或其他 CLI 工作流。开发与验证使用 Chrome 的未打包扩展流程：

1. 打开 `chrome://extensions/`，开启“开发者模式”，选择“加载已解压的扩展程序”，并选中仓库根目录。
2. 修改 `manifest.json`、HTML、CSS、JavaScript 或 `icons/` 后，在扩展管理页点击“重新加载”，然后重新打开 popup。
3. 在普通 `http:` 或 `https:` 页面手工验证受影响路径。至少覆盖首次扫描、重新扫描、`all`/`logo`/`favicon` 筛选、单项与批量复制、单项与批量下载、内嵌 SVG 预览、Web App Manifest 图标，以及非 HTTP(S) 页面上的错误状态。

## 运行时架构

`manifest.json` 是扩展配置的唯一入口：它将工具栏 action 指向 `popup.html`，声明静态 About 页面 `options.html`，并注册 `activeTab`、`scripting`、`downloads` 权限。没有 background/service worker、预注册 content script、扩展自有的后端或远程 API，且没有持久化扩展状态；popup 关闭后内存状态会丢失，下次打开重新扫描。

运行链路：

```text
manifest.json → action popup.html → popup.js (DOMContentLoaded)
  → scan() 查询当前活动标签页
  → chrome.scripting.executeScript() 注入 extractAssets()
  → { site, assets } 可序列化结果写入内存 state
  → 根据当前筛选条件从 popup.html 的 template 渲染资源卡片
  → Clipboard API / chrome.tabs / chrome.downloads 执行用户操作
```

`popup.js` 有两层运行边界：

- **Popup 层**：管理 `state = { assets, filter, site }`，处理重新扫描、筛选、渲染、复制、预览和下载。
- **注入页面的扫描层**：`extractor.js` 中的 `extractAssets()` 在目标网页上下文运行并读取真实 DOM。它必须保持自包含，不能依赖 popup 作用域的闭包、import 或状态；返回值必须可通过 `chrome.scripting.executeScript()` 克隆。

扫描器的返回契约为：

- `site`: `{ title, host }`
- `assets`: `{ url, type, label, meta, area }[]`
- 当前 `type` 仅为 `logo` 或 `favicon`。

## 资源提取约束

新增发现来源时，在 `extractAssets()` 内通过其 `add()` helper 登记资源。该 helper 统一处理相对 URL 解析、仅允许 HTTP(S) 或 `data:image` URL、去除 fragment 后去重和资源形状规范化；扫描器收尾阶段统一完成排序和结果上限。

当前扫描器汇集 favicon link 与 `/favicon.ico`、JSON-LD/Schema.org、Open Graph/Twitter 元数据、结合 `picture`/`srcset` 的 logo 图片启发式、受限的内嵌 SVG，以及带 3 秒中止超时的 Web App Manifest 图标。结果按 logo 优先、面积次序排序，最多返回 60 项。扩展扫描覆盖面时，保留内嵌 SVG 的大小/尺寸保护、Web Manifest 超时和资源数量上限。

新增资源类别时，如需独立筛选页签和计数，应同步补充对应 UI；同时验证现有通用渲染、badge 与下载命名是否满足该类别的展示和命名需求。

## UI 与共享样式

`popup.html` 中的结构性 ID/class 和资源卡片 template 与 `popup.js` 的 DOM 查询、事件绑定直接耦合；修改这些 selector 或 template 子元素时必须同步更新渲染逻辑。`extractor.js` 必须在 `popup.js` 之前加载，以便 popup 将自包含的 `extractAssets()` 传给 `chrome.scripting.executeScript()`。

`popup.css` 同时被 popup、静态 About 页 `options.html` 和隐私页 `privacy.html` 复用。修改 `body`、`.app`、`.status` 或 CSS variables 等全局规则时，需检查这三个视图。`options.html` 是信息展示页，不是持久化设置页面。

## 权限、隐私与发布同步点

权限保持最小化：`activeTab` 仅在用户显式调用时授予当前页访问，`scripting` 用于一次性注入扫描器，`downloads` 用于保存用户选择的资源。不要将扫描改成常驻或后台行为，除非同时审查 `manifest.json` 权限与隐私承诺。

资源提取在本地完成，不持久化或上传浏览数据；扫描器仅会尝试读取当前站点声明的 Web App Manifest 以发现图标。任何涉及行为、权限、安装步骤或数据处理的修改，都必须与 `README.md`、`PRIVACY.md` 和 `privacy.html` 的说明保持一致。

发布升版时，同步更新 `manifest.json` 的版本号和 `options.html` 中硬编码的显示版本。保留 `icons/` 下 manifest 直接引用的 16、32、48、128 像素图标文件。

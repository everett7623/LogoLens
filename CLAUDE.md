# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目与开发流程

LogoLens 是零依赖的 Chrome Manifest V3 扩展：使用原生 HTML、CSS、JavaScript 和静态 PNG 图标，从当前活动网页中提取 logo、favicon、内嵌 SVG、CSS 背景图、社交图片和 Web App Manifest 图标。没有后端、包管理器、构建工具、linter、测试框架或 CI 配置。

仓库保持扁平干净树：根目录只放 `manifest.json`、popup/options/privacy 入口、`extractor.js`、`icons/` 与契约文档；使用说明与截图在 `docs/`。不要引入 `src/`、WXT 或包管理器布局，也不要往根目录提交发布总结、临时报告、zip 或构建产物（见 `.gitignore`）。结构树见 [README.md](README.md)「项目结构」。

本仓库没有 `build`、`lint`、`test` 脚本；不要臆造 `npm`、`pnpm` 或其他 CLI 工作流。可用的静态校验只有下面三条，改动对应文件后手动执行：

```bash
node --check extractor.js
node --check popup.js
# PowerShell 下把 /dev/null 换成 $null
python -m json.tool manifest.json > /dev/null
```

功能验证使用 Chrome 的未打包扩展流程：

1. 打开 `chrome://extensions/`，开启“开发者模式”，选择“加载已解压的扩展程序”，并选中仓库根目录。
2. 修改 `manifest.json`、HTML、CSS、JavaScript 或 `icons/` 后，在扩展管理页点击“重新加载”，然后重新打开 popup。仅刷新网页不会重新加载扩展代码。
3. 在普通 `http:` 或 `https:` 页面手工验证受影响路径。至少覆盖首次扫描、重新扫描、`all`/`logo`/`favicon` 筛选、单项与批量复制、单项与批量下载、内嵌 SVG 预览、CSS 背景图 logo、shadow DOM 内的资源、Web App Manifest 图标，以及非 HTTP(S) 页面上的错误状态。

改动扫描器时，除 popup 手工验证外还可以脱离扩展直接跑一遍：起一个本地静态服务器，在页面上下文里 `eval` 一份 `extractor.js` 后调用 `await extractAssets()`，即可用受控 HTML 覆盖 sprite 引用、背景图尺寸边界和嵌套 shadow root 等分支。

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

`scan()` 用模块级单调计数器 `scanVersion` 做竞态守卫：每次扫描先自增并记录本次版本号，`await` 返回后如果 `version !== scanVersion` 就直接丢弃结果，不写 state、不渲染、不复位 `scanning`。连点重新扫描时只有最后一次生效。新增任何异步扫描分支都要沿用这个版本比对，否则旧结果会覆盖新结果。

扫描器的返回契约为：

- `site`: `{ title, host }`
- `assets`: `{ url, type, label, meta, area }[]`
- 当前 `type` 仅为 `logo` 或 `favicon`。

## 资源提取约束

新增发现来源时，在 `extractAssets()` 内通过其 `add()` helper 登记资源。该 helper 统一处理相对 URL 解析、仅允许 HTTP(S) 或 `data:image` URL、URL 长度上限（远程 8192、`data:` 200000）、按解析后完整 URL 去重（`#fragment` 指向 sprite 中的不同图形，必须保留）、每类型 120 项配额和资源形状规范化；扫描器收尾阶段统一完成排序和 60 项总量截断。

`add()` 的第一道门禁是 `type in typeCounts`：`typeCounts` 里没有登记的 `type` 会被**静默丢弃**，不报错也不出现在结果中。新增资源类别时必须先在 `typeCounts` 初始值中加入该键，否则整条来源看起来“扫不到东西”。`area` 为 0 时会按类型回填默认权重（logo 100000、favicon 100），直接影响排序位置。`add()` 返回是否真的登记成功，需要连续编号的来源（如内嵌 SVG）必须据此自增计数器，否则被过滤或去重的项会让编号跳号。

当前扫描器汇集 favicon link 与 `/favicon.ico`、JSON-LD/Schema.org、Open Graph/Twitter 元数据、结合 `picture`/`srcset` 的 logo 图片启发式、品牌与导航节点上的 CSS `background-image`、受限的内嵌 SVG，以及带 3 秒中止超时的 Web App Manifest 图标。结果按 logo 优先、面积次序排序。扩展扫描覆盖面时，保留下列全部保护。

- **DOM 遍历范围**：`eachLimited()` 遍历的是模块级 `roots` 数组，由一次广度优先搜索收集 `document` 与所有开放 shadow root，受 50 个根与 3000 个扫描节点双重限制。新增来源只要走 `eachLimited()` 就自动获得 shadow DOM 覆盖；直接调用 `document.querySelectorAll()` 则会漏掉 shadow 内容（`link[rel="manifest"]` 等文档级单例除外）。
- **内嵌 SVG**：跳过不可见节点、超过 800px 的尺寸和超过 50000 字符的 `outerHTML`，再序列化成 `data:image/svg+xml` URL。由于 `data:` URL 是独立文档，`inlineUseRefs()` 会把 `<use href="#id">` 指向的同页 sprite 节点克隆进副本的 `<defs>`（循环处理到无新增引用为止，支持 symbol 内部任意深度再引用；每个 id 至多内联一次、总量上限 32，超出按无法还原放弃整个 SVG），空引用直接跳过，并把 `xlink:href` 规范化为 `href`；指向外部 sprite 文件的引用无法离线还原，整个 SVG 直接放弃。内联会增大体积，所以序列化前要再校验一次长度上限。
- **CSS 背景图**：逐层登记节点 `backgroundImage` 中的全部 `url()`（重复由 `add()` 去重兜底），跳过不可见节点，并丢弃任一边超过 `MAX_BG_DIM`（400px）的盒子——大盒子几乎都是横幅或装饰背景，且其面积会把噪音顶到排序最前。该来源用 `getComputedStyle()`，因此受 `MAX_NODES_PER_SOURCE`（200）约束以控制成本。

新增资源类别时，如需独立筛选页签和计数，应同步补充对应 UI；同时验证现有通用渲染、badge 与下载命名是否满足该类别的展示和命名需求。

## UI 与共享样式

`popup.html` 中的结构性 ID/class 和资源卡片 template 与 `popup.js` 的 DOM 查询、事件绑定直接耦合；修改这些 selector 或 template 子元素时必须同步更新渲染逻辑。`extractor.js` 必须在 `popup.js` 之前加载，以便 popup 将自包含的 `extractAssets()` 传给 `chrome.scripting.executeScript()`。

`popup.css` 同时被 popup、静态 About 页 `options.html` 和隐私页 `privacy.html` 复用。修改 `body`、`.app`、`.status` 或 CSS variables 等全局规则时，需检查这三个视图。`options.html` 是信息展示页，不是持久化设置页面。

界面文案、错误提示、toast 与扫描器产出的 `label` 统一使用简体中文，技术名词（`Open Graph Image`、`Apple Touch Icon`、`Web App Icon` 等）保留英文原文。

代码风格沿用现有约定：两空格缩进，JavaScript 用双引号和分号，函数/变量 `camelCase`，扫描器上限常量 `UPPER_SNAKE_CASE`，CSS class 用 kebab-case。仓库同时存在面向其他 agent 的 `AGENTS.md`，其中的结构、风格与发布约定应与本文件保持一致。

## 复制与下载行为契约

底部的“复制当前列表”和“下载当前列表”只作用于**当前筛选结果**，不是全量 `state.assets`。下载文件名中的序号也来自筛选后列表的下标，因此同一资源在不同页签下载会得到不同编号。

两条下载路径的命名和交互不同，改动其一时要同时确认另一条：

- 单项下载：`saveAs: true`，按站点分目录 `LogoLens/{host}/{type}-{序号}.{ext}`。
- 批量下载：`saveAs: false`，按站点分目录 `LogoLens/{host}/{type}-{序号}.{ext}`，逐项串行创建并统计失败数。

扩展名由 `fileType()` 从 `data:` MIME 或 URL 后缀推断，命中白名单外一律回落为 `PNG`；`safeName()` 会把 host 规范化为 `[a-z0-9.-]`。命名规则在 `docs/USAGE.md` 中有面向用户的说明，修改后需同步。卡片预览图固定 `referrerPolicy = "no-referrer"`，加载失败时给卡片加 `image-error` class 而不是移除卡片。

## 权限、隐私与发布同步点

权限保持最小化：`activeTab` 仅在用户显式调用时授予当前页访问，`scripting` 用于一次性注入扫描器，`downloads` 用于保存用户选择的资源。不要将扫描改成常驻或后台行为，除非同时审查 `manifest.json` 权限与隐私承诺。

资源提取在本地完成，不持久化或上传浏览数据；扫描器仅会尝试读取当前站点声明的 Web App Manifest 以发现图标。任何涉及行为、权限、安装步骤或数据处理的修改，都必须与 `README.md`、`docs/USAGE.md`、`PRIVACY.md` 和 `privacy.html` 的说明保持一致（权限表在 `README.md`、`PRIVACY.md`、`privacy.html` 中重复了三份）。

版本号在多处硬编码，发布升版时需要全部更新：`manifest.json` 的 `version`、`options.html` 的版本行、`README.md`（当前版本与 `LogoLens-v<版本>.zip` 下载名）、`docs/USAGE.md`（开篇版本与同名 zip），并在 `CHANGELOG.md` 追加条目与底部链接。用 `grep -rn "<上一版本号>"` 自查是否有遗漏。保留 `icons/` 下 manifest 直接引用的 16、32、48、128 像素图标文件。

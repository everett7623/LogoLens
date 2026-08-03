# LogoLens - 网站 Logo 与 Favicon 提取器

作者：[everettlabs](https://everettlabs.dev/) · [支持咖啡](https://everettlabs.dev/coffee/)

一个无需服务器、无需登录的 Chrome Manifest V3 插件。打开任意网站后，点击插件即可扫描并提取：

- 页面中常见位置的 Logo 图片
- 内嵌 SVG Logo
- favicon、Apple Touch Icon、Mask Icon
- Web App Manifest 中声明的应用图标
- Open Graph 图片

支持图片预览、分类筛选、复制链接、单个下载及批量下载。

## 安装

1. 解压 `LogoLens-Chrome-Extension.zip`
2. Chrome 地址栏打开 `chrome://extensions/`
3. 打开右上角「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择解压后的 `LogoLens` 文件夹

## 使用

打开需要提取的网站，点击浏览器工具栏中的 LogoLens 图标。插件会自动扫描当前页面，点击「复制」或「下载」即可。

## 权限说明

- `activeTab`：仅在你主动点击插件时读取当前网页
- `scripting`：在当前页面执行一次资源扫描
- `downloads`：保存提取到的图片

插件不会将浏览数据上传到作者或任何自有服务器。为展示和下载页面声明的图片，浏览器会连接对应图片的原始服务器；扫描 Web App Manifest 时也会请求当前页面声明的 Manifest 地址。

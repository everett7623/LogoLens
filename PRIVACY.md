# 隐私政策

LogoLens 不会收集、存储用户数据，也不会将浏览数据上传到作者或任何自有服务器。

本插件仅在用户主动点击浏览器工具栏图标时，读取当前活动标签页的 DOM 和页面元数据，以提取 Logo、Favicon 等图片地址。提取和分类逻辑在本地完成。为展示或下载页面声明的图片，浏览器会连接对应资源的原始服务器；扫描 Web App Manifest 时也会请求当前页面声明的 Manifest 地址。上述请求可能向资源服务器暴露常规网络信息，例如 IP 地址、User-Agent 和请求中的 URL 参数。

## 权限说明

- `activeTab`：仅在点击插件时访问当前页面。
- `scripting`：在当前页面运行一次资源提取脚本。
- `downloads`：将用户选择的图片保存到本地。

## 作者

- 作者：everettlabs
- 邮箱：[everett7623@gmail.com](mailto:everett7623@gmail.com)
- 主页：https://everettlabs.dev/
- 支持：https://everettlabs.dev/coffee/

const state = { assets: [], filter: "all", site: null };
let scanVersion = 0;
let toastTimer = null;
const flashTimers = new WeakMap();

const $ = (selector) => document.querySelector(selector);
const statusEl = $("#status");
const resultsEl = $("#results");
const footerEl = $("#footer");
const template = $("#cardTemplate");

async function scan() {
  const version = ++scanVersion;
  setScanning(true);
  showLoading();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(tab.url || "")) {
      throw new Error("请在普通网站页面中使用此插件，Chrome 内部页面无法扫描。");
    }
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractAssets });
    if (version !== scanVersion) return;
    state.site = result?.site || null;
    state.assets = result?.assets || [];
    renderSite();
    render();
  } catch (error) {
    if (version !== scanVersion) return;
    showError(error.message || "扫描失败，请刷新页面后重试。");
  } finally {
    if (version === scanVersion) setScanning(false);
  }
}

function renderSite() {
  if (!state.site) return;
  $("#siteTitle").textContent = state.site.title;
  $("#siteTitle").title = state.site.title;
  $("#siteHost").textContent = state.site.host;
  $("#siteHost").title = state.site.host;
  $("#site").classList.remove("hidden");
}

function filteredAssets() {
  return state.filter === "all" ? state.assets : state.assets.filter((asset) => asset.type === state.filter);
}

function render() {
  const visible = filteredAssets();
  $("#allCount").textContent = state.assets.length;
  $("#logoCount").textContent = state.assets.filter((asset) => asset.type === "logo").length;
  $("#faviconCount").textContent = state.assets.filter((asset) => asset.type === "favicon").length;
  $("#count").textContent = `${state.assets.length} 个资源`;
  resultsEl.setAttribute("aria-busy", "false");
  resultsEl.setAttribute("aria-label", `${state.filter === "all" ? "全部" : state.filter}资源，共 ${visible.length} 项`);
  resultsEl.replaceChildren();

  if (!visible.length) {
    showError(state.assets.length ? "当前分类中没有找到资源。" : "没有发现 Logo 或 Favicon，可尝试刷新页面后重新扫描。", false);
    return;
  }

  statusEl.classList.add("hidden");
  resultsEl.classList.remove("hidden");
  footerEl.classList.remove("hidden");

  const fragment = document.createDocumentFragment();
  visible.forEach((asset, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const image = card.querySelector(".preview");
    const previewButton = card.querySelector(".preview-wrap");
    const isInline = asset.url.startsWith("data:");
    image.referrerPolicy = "no-referrer";
    image.src = asset.url;
    image.alt = "";
    image.addEventListener("error", () => card.classList.add("image-error"));
    previewButton.disabled = isInline;
    previewButton.title = isInline ? "内嵌图片仅支持预览和下载" : "在新标签页中打开图片";
    previewButton.setAttribute("aria-label", isInline ? `${asset.label}，内嵌图片预览` : `打开 ${asset.label}`);
    if (!isInline) previewButton.addEventListener("click", () => openImage(asset.url));
    card.querySelector(".type-badge").textContent = asset.type;
    card.querySelector(".asset-name").textContent = asset.label;
    card.querySelector(".asset-name").title = asset.label;
    card.querySelector(".asset-meta").textContent = asset.meta || fileType(asset.url);
    card.querySelector(".asset-url").textContent = asset.url;
    card.querySelector(".asset-url").title = asset.url;
    const copyButton = card.querySelector(".copy-button");
    const downloadButton = card.querySelector(".download-button");
    copyButton.setAttribute("aria-label", `复制 ${asset.label} 的链接`);
    downloadButton.setAttribute("aria-label", `下载 ${asset.label}`);
    copyButton.addEventListener("click", (event) => copyUrl(asset.url, event.currentTarget));
    downloadButton.addEventListener("click", () => downloadAsset(asset, index, downloadButton));
    fragment.append(card);
  });
  resultsEl.append(fragment);
}

function setStatus(message, loading = false, status = "empty") {
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  statusEl.replaceChildren();
  statusEl.dataset.state = loading ? "loading" : status;
  if (loading) {
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    statusEl.append(spinner);
  } else {
    const symbol = document.createElement("div");
    symbol.className = "status-symbol";
    symbol.textContent = status === "error" ? "!" : "—";
    symbol.setAttribute("aria-hidden", "true");
    statusEl.append(symbol);
  }
  statusEl.append(paragraph);
  statusEl.classList.remove("hidden");
}

function showLoading() {
  hideToast();
  setStatus("正在分析当前页面…", true);
  resultsEl.setAttribute("aria-busy", "true");
  resultsEl.classList.add("hidden");
  footerEl.classList.add("hidden");
  $("#site").classList.toggle("hidden", !state.site);
  $("#count").textContent = "扫描中";
}

function showError(message, fatal = true) {
  setStatus(message, false, fatal ? "error" : "empty");
  resultsEl.setAttribute("aria-busy", "false");
  resultsEl.classList.add("hidden");
  footerEl.classList.add("hidden");
}

function setScanning(scanning) {
  const button = $("#rescan");
  button.disabled = scanning;
  button.classList.toggle("is-spinning", scanning);
  button.setAttribute("aria-busy", String(scanning));
}

function showNotice(message, tone = "success") {
  clearTimeout(toastTimer);
  const toast = $("#toast");
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.remove("hidden");
  toastTimer = setTimeout(hideToast, 2400);
}

function hideToast() {
  clearTimeout(toastTimer);
  $("#toast").classList.add("hidden");
}

// 连点时复用同一个计时器，避免把临时文案误存成原始文案导致按钮文字卡死。
function flashButton(button, message, duration = 1000) {
  const running = flashTimers.get(button);
  if (running) clearTimeout(running);
  else button.dataset.label = button.textContent;
  button.textContent = message;
  flashTimers.set(button, setTimeout(() => {
    button.textContent = button.dataset.label;
    flashTimers.delete(button);
  }, duration));
}

async function copyUrl(url, button) {
  try {
    await navigator.clipboard.writeText(url);
    flashButton(button, "已复制");
  } catch {
    showNotice("复制失败，请检查剪贴板权限后重试。", "error");
  }
}

async function copyAll() {
  const assets = filteredAssets();
  if (!assets.length) return;
  try {
    await navigator.clipboard.writeText(assets.map((asset) => asset.url).join("\n"));
    flashButton($("#copyAll"), "已复制", 1200);
  } catch {
    showNotice("复制失败，请检查剪贴板权限后重试。", "error");
  }
}

function openImage(url) {
  if (!url || url.startsWith("data:")) return;
  chrome.tabs.create({ url, active: true }).catch(() => showNotice("无法打开该图片链接。", "error"));
}

async function downloadAsset(asset, index, button) {
  button.disabled = true;
  try {
    await chrome.downloads.download({
      url: asset.url,
      filename: `LogoLens/${safeName(state.site?.host || "website")}-${asset.type}-${index + 1}.${fileType(asset.url).toLowerCase()}`,
      saveAs: true
    });
    showNotice("下载任务已创建。");
  } catch {
    showNotice("下载未完成，请检查权限或资源地址。", "error");
  } finally {
    button.disabled = false;
  }
}

async function downloadAll() {
  const button = $("#downloadAll");
  const assets = filteredAssets();
  if (!assets.length) return;
  const original = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  let failed = 0;
  try {
    for (const [index, asset] of assets.entries()) {
      button.textContent = `下载中 ${index + 1}/${assets.length}`;
      try {
        await chrome.downloads.download({
          url: asset.url,
          filename: `LogoLens/${safeName(state.site?.host || "website")}/${asset.type}-${index + 1}.${fileType(asset.url).toLowerCase()}`,
          saveAs: false
        });
      } catch {
        failed += 1;
      }
    }
    showNotice(failed ? `已创建 ${assets.length - failed} 项下载，${failed} 项失败。` : `已创建 ${assets.length} 项下载。`, failed ? "error" : "success");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = original;
  }
}

function fileType(url) {
  const data = url.match(/^data:image\/([a-z0-9+]+)(?:[;,]|$)/i);
  if (data) {
    const raw = data[1].toLowerCase();
    if (raw.includes("svg")) return "SVG";
    if (raw.includes("jpeg")) return "JPEG";
    if (raw.includes("png")) return "PNG";
    if (raw.includes("webp")) return "WEBP";
    if (raw.includes("gif")) return "GIF";
    if (raw.includes("avif")) return "AVIF";
    return raw.toUpperCase();
  }
  const clean = url.split(/[?#]/)[0];
  const extension = clean.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toUpperCase();
  return ["PNG", "JPG", "JPEG", "WEBP", "SVG", "ICO", "GIF", "AVIF"].includes(extension) ? extension : "PNG";
}

function safeName(value) {
  return value.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-|-$/g, "") || "website";
}

document.addEventListener("DOMContentLoaded", scan);
$("#rescan").addEventListener("click", scan);
$("#copyAll").addEventListener("click", copyAll);
$("#downloadAll").addEventListener("click", downloadAll);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    state.filter = tab.dataset.filter;
    render();
  });
});

document.querySelectorAll("#footer a").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: link.href, active: true }).catch(() => showNotice("无法打开链接。", "error"));
  });
});

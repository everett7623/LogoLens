async function extractAssets() {
  const MAX_ASSETS = 60;
  const MAX_ITEMS_PER_TYPE = MAX_ASSETS * 2;
  const MAX_NODES_PER_SOURCE = 200;
  const MAX_JSON_LD_SCRIPTS = 30;
  const MAX_JSON_LD_LENGTH = 200000;
  const MAX_JSON_NODES = 1000;
  const MAX_SVG_NODES = MAX_ASSETS;
  const MAX_SVG_EL_LENGTH = 50000;
  const MAX_SVG_DIM = 800;
  const MAX_SVG_USE_PASSES = 3;
  const MAX_BG_DIM = 400;
  const MAX_SHADOW_ROOTS = 50;
  const MAX_SHADOW_SCAN_NODES = 3000;
  const MAX_MANIFEST_LENGTH = 500000;
  const MAX_REMOTE_URL_LENGTH = 8192;
  const MAX_DATA_URL_LENGTH = 200000;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";

  const absolute = (value, base = document.baseURI) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try { return new URL(value, base).href; } catch { return null; }
  };

  // 广度优先收集 document 与开放 shadow root，受根数量和扫描节点数双重限制。
  const roots = (() => {
    const list = [document];
    const queue = [document];
    let scanned = 0;
    while (queue.length) {
      const root = queue.shift();
      let nodes;
      try { nodes = root.querySelectorAll("*"); } catch { continue; }
      for (const node of nodes) {
        if (scanned >= MAX_SHADOW_SCAN_NODES || list.length >= MAX_SHADOW_ROOTS) return list;
        scanned += 1;
        const shadow = node.shadowRoot;
        if (shadow) {
          list.push(shadow);
          queue.push(shadow);
        }
      }
    }
    return list;
  })();

  const eachLimited = (selector, callback, limit = MAX_NODES_PER_SOURCE) => {
    let index = 0;
    for (const root of roots) {
      let nodes;
      try { nodes = root.querySelectorAll(selector); } catch { continue; }
      for (const node of nodes) {
        if (index >= limit) return;
        callback(node, index);
        index += 1;
      }
    }
  };

  const isVisible = (style) => {
    return style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.opacity) !== 0;
  };

  const seen = new Set();
  const items = [];
  const typeCounts = { logo: 0, favicon: 0 };

  const parseSize = (value) => {
    if (typeof value !== "string" || !value) return { area: 0, meta: "" };
    let best = null;
    for (const match of value.matchAll(/(\d+)\s*x\s*(\d+)/gi)) {
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      const area = width * height;
      if (!best || area > best.area) best = { area, meta: `${width} × ${height}` };
    }
    return best || { area: 0, meta: value };
  };

  const srcsetMeta = (value) => {
    if (typeof value !== "string" || !value) return { area: 0, meta: "" };
    let best = null;
    for (const match of value.matchAll(/\s(\d+(?:\.\d+)?)(w|x)(?=\s*(?:,|$))/gi)) {
      const number = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      const area = unit === "w" ? number * number : number * 100000;
      if (!best || area > best.area) best = { area, meta: `${number}${unit}` };
    }
    return best || { area: 0, meta: "" };
  };

  const bestImageSrc = (img) => {
    return img.currentSrc || img.src || img.getAttribute("src") || "";
  };

  const imageMeta = (img) => {
    let width = img.naturalWidth || img.width || img.getAttribute("width") || 0;
    let height = img.naturalHeight || img.height || img.getAttribute("height") || 0;
    width = parseInt(width, 10) || 0;
    height = parseInt(height, 10) || 0;
    if (width && height) return { area: width * height, meta: `${width} × ${height}` };
    return srcsetMeta(img.srcset);
  };

  // 登记成功返回 true，便于调用方按实际入选项编号。
  const add = (url, type, label, meta = "", area = 0, base = document.baseURI) => {
    if (!(type in typeCounts) || typeCounts[type] >= MAX_ITEMS_PER_TYPE) return false;
    const resolved = absolute(url, base);
    if (!resolved || !/^https?:|^data:image\//i.test(resolved)) return false;
    const maxLength = resolved.startsWith("data:") ? MAX_DATA_URL_LENGTH : MAX_REMOTE_URL_LENGTH;
    if (resolved.length > maxLength) return false;
    const key = resolved.split("#")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    typeCounts[type] += 1;
    if (!area) area = type === "logo" ? 100000 : 100;
    items.push({ url: resolved, type, label, meta, area });
    return true;
  };

  const iconRels = [
    'link[rel~="icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="mask-icon"]',
    'link[rel="fluid-icon"]'
  ];

  for (const selector of iconRels) {
    eachLimited(selector, (node) => {
      const rel = (node.rel || "").toLowerCase();
      const label = rel.includes("apple") ? "Apple Touch Icon" : rel.includes("mask") ? "Mask Icon" : rel.includes("fluid") ? "Fluid Icon" : "Favicon";
      const size = parseSize(node.getAttribute("sizes") || node.getAttribute("type") || "");
      add(node.href, "favicon", label, size.meta, size.area);
    });
  }

  // 默认 favicon 相对站点根目录解析，不受页面 <base href> 影响。
  add("/favicon.ico", "favicon", "默认 Favicon", "ICO", 0, location.origin);

  let jsonNodes = 0;
  const addStructuredImage = (value, label) => {
    if (typeof value === "string") {
      add(value, "logo", label);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => addStructuredImage(item, label));
      return;
    }
    if (!value || typeof value !== "object") return;
    const url = [value.url, value.contentUrl, value["@id"]].find((item) => typeof item === "string");
    if (url) add(url, "logo", label);
  };

  const walkStructuredData = (value) => {
    if (!value || typeof value !== "object" || jsonNodes >= MAX_JSON_NODES) return;
    jsonNodes += 1;
    if (Array.isArray(value)) {
      for (const item of value) walkStructuredData(item);
      return;
    }
    if ("logo" in value) addStructuredImage(value.logo, "Schema.org Logo");
    if ("image" in value) addStructuredImage(value.image, "Schema.org Image");
    for (const [key, nested] of Object.entries(value)) {
      if (key !== "logo" && key !== "image" && key !== "@context") walkStructuredData(nested);
    }
  };

  eachLimited('script[type="application/ld+json"]', (script) => {
    const text = script.textContent || "";
    if (!text || text.length > MAX_JSON_LD_LENGTH) return;
    try { walkStructuredData(JSON.parse(text)); } catch {}
  }, MAX_JSON_LD_SCRIPTS);

  eachLimited('link[itemprop="logo"], link[itemprop="image"], meta[itemprop="logo"], meta[itemprop="image"]', (node) => {
    const value = node.getAttribute("href") || node.getAttribute("content");
    if (value) add(value, "logo", "Schema.org Logo", node.getAttribute("itemprop") || "");
  });

  eachLimited('meta[property="og:image"], meta[name="twitter:image"], meta[name="twitter:image:src"]', (node) => {
    const value = node.getAttribute("content");
    if (!value) return;
    const label = node.getAttribute("property") === "og:image" ? "Open Graph Image" : "Twitter Image";
    add(value, "logo", label);
  });

  const logoImgSelectors = [
    'img[itemprop="logo"]',
    'img[alt*="logo" i]', 'img[class*="logo" i]', 'img[id*="logo" i]',
    '[class*="logo" i] img', '[id*="logo" i] img',
    'picture [class*="logo" i] img',
    'header img', 'nav img', 'a[aria-label*="home" i] img',
    'a[href="/"] img', 'a[href="/home"] img'
  ];

  eachLimited(logoImgSelectors.join(","), (img) => {
    const url = bestImageSrc(img);
    if (!url) return;
    const info = imageMeta(img);
    add(url, "logo", (img.alt || img.title || "网站 Logo").trim(), info.meta, info.area);
  });

  const backgroundSelectors = [
    '[class*="logo" i]', '[id*="logo" i]',
    '[class*="brand" i]', '[id*="brand" i]',
    'header a', 'nav a',
    'a[href="/"]', 'a[href="/home"]', 'a[aria-label*="home" i]'
  ];

  eachLimited(backgroundSelectors.join(","), (node) => {
    try {
      const style = getComputedStyle(node);
      if (!isVisible(style)) return;
      const raw = style.backgroundImage;
      if (!raw || raw === "none") return;
      const match = raw.match(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/i);
      const value = ((match && (match[1] || match[2] || match[3])) || "").trim();
      if (!value) return;
      const box = node.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      // 过大的盒子通常是横幅或装饰背景，不是 logo。
      if (box.width > MAX_BG_DIM || box.height > MAX_BG_DIM) return;
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      add(value, "logo", "CSS 背景 Logo", `${width} × ${height}`, width * height);
    } catch {}
  });

  // data: URL 是独立文档，指向页面 sprite 的 <use> 会失效，需要把被引用节点内联进副本。
  const inlineUseRefs = (clone, root) => {
    const source = root && typeof root.getElementById === "function" ? root : document;
    const inlined = new Set();
    let defs = null;
    for (let pass = 0; pass < MAX_SVG_USE_PASSES; pass += 1) {
      let added = 0;
      for (const use of clone.querySelectorAll("use")) {
        const raw = (use.getAttribute("href") || use.getAttribute("xlink:href") || "").trim();
        // 指向外部 sprite 文件的引用无法内联，整个 SVG 放弃。
        if (!raw.startsWith("#")) return false;
        const id = raw.slice(1);
        if (!id) return false;
        use.setAttribute("href", raw);
        use.removeAttributeNS(XLINK_NS, "href");
        if (inlined.has(id)) continue;
        inlined.add(id);
        let escaped;
        try { escaped = `#${CSS.escape(id)}`; } catch { return false; }
        if (clone.id === id || clone.querySelector(escaped)) continue;
        const target = source.getElementById(id);
        if (!target || target.namespaceURI !== SVG_NS) return false;
        if (!defs) {
          defs = document.createElementNS(SVG_NS, "defs");
          clone.insertBefore(defs, clone.firstChild);
        }
        defs.append(target.cloneNode(true));
        added += 1;
      }
      if (!added) break;
    }
    return true;
  };

  const svgSelectors = [
    'header svg', 'nav svg',
    'svg[class*="logo" i]', '[class*="logo" i] svg', '[id*="logo" i] svg',
    'a[href="/"] svg', 'a[href="/home"] svg', 'a[aria-label*="home" i] svg'
  ];

  // 被过滤或去重的 SVG 不占用编号，避免结果里出现跳号的“内嵌 SVG Logo 3”。
  let svgIndex = 0;
  eachLimited(svgSelectors.join(","), (svg) => {
    try {
      const style = getComputedStyle(svg);
      const box = svg.getBoundingClientRect();
      if (!isVisible(style)) return;
      if (box.width <= 0 || box.height <= 0 || box.width > MAX_SVG_DIM || box.height > MAX_SVG_DIM) return;
      if (svg.outerHTML.length > MAX_SVG_EL_LENGTH) return;
      const clone = svg.cloneNode(true);
      if (!inlineUseRefs(clone, svg.getRootNode())) return;
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", SVG_NS);
      const markup = clone.outerHTML;
      // 内联 sprite 后体积会增大，需要重新校验上限。
      if (markup.length > MAX_SVG_EL_LENGTH) return;
      const data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      if (add(data, "logo", `内嵌 SVG Logo ${svgIndex + 1}`, `${width} × ${height}`, width * height)) {
        svgIndex += 1;
      }
    } catch {}
  }, MAX_SVG_NODES);

  const manifestLink = document.querySelector('link[rel="manifest"]');
  const manifestUrl = absolute(manifestLink?.getAttribute("href") || "");
  if (manifestUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(manifestUrl, { credentials: "same-origin", signal: controller.signal });
      const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
      if (response.ok && (!contentLength || contentLength <= MAX_MANIFEST_LENGTH)) {
        const text = await response.text();
        if (text.length <= MAX_MANIFEST_LENGTH) {
          const manifest = JSON.parse(text);
          const manifestBase = response.url || manifestUrl;
          if (Array.isArray(manifest.icons)) {
            manifest.icons.slice(0, MAX_NODES_PER_SOURCE).forEach((icon) => {
              if (!icon || typeof icon.src !== "string") return;
              const size = parseSize(icon.sizes || icon.type || "");
              add(icon.src, "favicon", "Web App Icon", size.meta, size.area, manifestBase);
            });
          }
        }
      }
    } catch {
    } finally {
      clearTimeout(timeout);
    }
  }

  items.sort((a, b) => {
    if (a.type === b.type) return (b.area || 0) - (a.area || 0);
    return a.type === "logo" ? -1 : 1;
  });

  return {
    site: { title: document.title || location.hostname, host: location.hostname },
    assets: items.slice(0, MAX_ASSETS)
  };
}

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
  const MAX_MANIFEST_LENGTH = 500000;
  const MAX_REMOTE_URL_LENGTH = 8192;
  const MAX_DATA_URL_LENGTH = 200000;

  const absolute = (value, base = document.baseURI) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try { return new URL(value, base).href; } catch { return null; }
  };

  const eachLimited = (selector, callback, limit = MAX_NODES_PER_SOURCE) => {
    let index = 0;
    for (const node of document.querySelectorAll(selector)) {
      if (index >= limit) break;
      callback(node, index);
      index += 1;
    }
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

  const add = (url, type, label, meta = "", area = 0, base = document.baseURI) => {
    if (!(type in typeCounts) || typeCounts[type] >= MAX_ITEMS_PER_TYPE) return;
    const resolved = absolute(url, base);
    if (!resolved || !/^https?:|^data:image\//i.test(resolved)) return;
    const maxLength = resolved.startsWith("data:") ? MAX_DATA_URL_LENGTH : MAX_REMOTE_URL_LENGTH;
    if (resolved.length > maxLength) return;
    const key = resolved.split("#")[0];
    if (seen.has(key)) return;
    seen.add(key);
    typeCounts[type] += 1;
    if (!area) area = type === "logo" ? 100000 : 100;
    items.push({ url: resolved, type, label, meta, area });
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

  add("/favicon.ico", "favicon", "默认 Favicon", "ICO");

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

  const svgSelectors = [
    'header svg', 'nav svg',
    'svg[class*="logo" i]', '[class*="logo" i] svg', '[id*="logo" i] svg',
    'a[href="/"] svg', 'a[href="/home"] svg', 'a[aria-label*="home" i] svg'
  ];

  eachLimited(svgSelectors.join(","), (svg, index) => {
    try {
      const style = getComputedStyle(svg);
      const box = svg.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) return;
      if (box.width <= 0 || box.height <= 0 || box.width > MAX_SVG_DIM || box.height > MAX_SVG_DIM) return;
      if (svg.outerHTML.length > MAX_SVG_EL_LENGTH) return;
      const clone = svg.cloneNode(true);
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clone.outerHTML)}`;
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      add(data, "logo", `内嵌 SVG Logo ${index + 1}`, `${width} × ${height}`, width * height);
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

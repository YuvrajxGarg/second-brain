// Right-click menu: save a page, link, image or selected text without opening the popup.
import { capture } from "./lib.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "page", title: "Save page to Second Brain", contexts: ["page"] });
    chrome.contextMenus.create({ id: "link", title: "Save link to Second Brain", contexts: ["link"] });
    chrome.contextMenus.create({ id: "image", title: "Save image to Second Brain", contexts: ["image"] });
    chrome.contextMenus.create({ id: "video", title: "Save video link to Second Brain", contexts: ["video"] });
    chrome.contextMenus.create({ id: "selection", title: "Save selection to Second Brain", contexts: ["selection"] });
  });
});

async function fetchImage(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
    return new File([blob], `image.${ext}`, { type: blob.type });
  } catch {
    return null; // site blocks cross-origin fetches; we still keep the URL
  }
}

function badge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const page = { url: info.pageUrl || tab?.url || "", title: tab?.title || "" };
  let data;
  switch (info.menuItemId) {
    case "page":
      data = { url: page.url, pageTitle: page.title };
      break;
    case "link":
      data = { url: info.linkUrl, text: info.selectionText ? `Link text: ${info.selectionText}` : "", pageTitle: "" };
      data.text = [data.text, `Found on: ${page.title} (${page.url})`].filter(Boolean).join("\n");
      break;
    case "image": {
      const img = await fetchImage(info.srcUrl);
      data = {
        url: page.url,
        pageTitle: page.title,
        text: `Image: ${info.srcUrl}${img ? "" : "\n(Couldn't download the image itself; the link above is all that was saved.)"}`,
        files: img ? [img] : [],
      };
      break;
    }
    case "video":
      data = { url: page.url, pageTitle: page.title, text: `Video: ${info.srcUrl}` };
      break;
    case "selection":
      data = { url: page.url, pageTitle: page.title, text: `> ${info.selectionText}` };
      break;
    default:
      return;
  }
  data.via = "quick-capture right-click";
  badge("…", "#7c3aed");
  try {
    await capture(data);
    badge("✓", "#15803d");
  } catch (e) {
    badge("!", "#b91c1c");
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Second Brain: not saved",
      message: e.message || String(e),
    });
  }
});

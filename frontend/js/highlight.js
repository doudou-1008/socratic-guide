// 内容渲染：转义 + 代码块高亮（highlight.js），以及主题色切换。

export function setAccent(color) {
  document.documentElement.style.setProperty("--accent", color);
}

export function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const FENCE = /```(\w+)?\n([\s\S]*?)```/g;

// 把文本渲染进容器：普通文字保留换行，```代码块```高亮。
export function renderContent(container, text) {
  container.innerHTML = "";
  let last = 0;
  let m;
  FENCE.lastIndex = 0;
  while ((m = FENCE.exec(text)) !== null) {
    if (m.index > last) {
      const p = document.createElement("div");
      p.className = "whitespace-pre-wrap";
      p.textContent = text.slice(last, m.index);
      container.appendChild(p);
    }
    const lang = m[1] || "text";
    const code = m[2];
    const pre = document.createElement("pre");
    pre.className = "my-2 rounded-lg bg-gray-900 text-gray-100 p-3 overflow-x-auto text-xs";
    const codeEl = document.createElement("code");
    codeEl.className = "language-" + lang;
    codeEl.textContent = code;
    pre.appendChild(codeEl);
    container.appendChild(pre);
    if (window.hljs) window.hljs.highlightElement(codeEl);
    last = FENCE.lastIndex;
  }
  if (last < text.length) {
    const p = document.createElement("div");
    p.className = "whitespace-pre-wrap";
    p.textContent = text.slice(last);
    container.appendChild(p);
  }
}

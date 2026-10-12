// 聊天 + 读 SSE 流（用 fetch + getReader，绝不用 EventSource）
import { store, API_BASE } from "./store.js";
import { setStage } from "./progress.js";
import { renderContent } from "./highlight.js";

const chatEl = document.getElementById("chat");

function scrollDown() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

// 创建一个消息气泡，返回"内容容器"用于后续填充
function addMessage(role, text = "") {
  const wrap = document.createElement("div");
  wrap.className = "mb-3 flex " + (role === "user" ? "justify-end" : "justify-start");

  const bubble = document.createElement("div");
  bubble.className =
    "max-w-[80%] rounded-2xl px-4 py-2 " +
    (role === "user" ? "bg-accent text-white" : "bg-white text-gray-800 border");

  const content = document.createElement("div");
  content.className = "whitespace-pre-wrap text-sm leading-relaxed";
  if (text) renderContent(content, text);

  bubble.appendChild(content);
  wrap.appendChild(bubble);
  chatEl.appendChild(wrap);
  scrollDown();
  return content;
}

export function showEmpty() {
  const el = document.createElement("div");
  el.id = "empty-state";
  el.className = "text-center text-gray-400 text-sm mt-10";
  el.textContent = "我是苏格拉底式导师，只提问、不回答。说说你卡在哪里？";
  chatEl.appendChild(el);
}

export function renderHistory(history) {
  chatEl.innerHTML = "";
  if (!history || history.length === 0) {
    showEmpty();
    return;
  }
  history.forEach((m) => {
    const role = m.role === "user" ? "user" : "assistant";
    const content = addMessage(role, "");
    renderContent(content, m.content || "");
  });
}

// 工具结果（如 Judge0）以卡片展示
function showTool(payload) {
  const wrap = document.createElement("div");
  wrap.className = "mb-3 flex justify-start";
  const card = document.createElement("div");
  card.className = "max-w-[80%] rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs";
  const title = document.createElement("div");
  title.className = "font-semibold text-gray-600 mb-1";
  title.textContent = "⚙️ " + (payload.name || "tool") + " 运行结果";
  const pre = document.createElement("pre");
  pre.className = "whitespace-pre-wrap text-gray-700";
  pre.textContent = (payload.stdout || "") + (payload.stderr ? "\n[stderr]\n" + payload.stderr : "");
  card.appendChild(title);
  card.appendChild(pre);
  wrap.appendChild(card);
  chatEl.appendChild(wrap);
  scrollDown();
}

function handleEvent(payload, contentEl, fullText) {
  switch (payload.type) {
    case "token":
      fullText.v += payload.content;
      contentEl.textContent = fullText.v; // 流式阶段用纯文本，done 时再高亮
      scrollDown();
      break;
    case "stage":
      setStage(store.state.track, payload.stage, payload.label);
      break;
    case "tool":
      showTool(payload);
      break;
    case "error":
      contentEl.textContent += "\n[错误：" + payload.message + "]";
      break;
    case "done":
      renderContent(contentEl, fullText.v); // 完成后再做代码高亮
      break;
  }
}

export async function sendMessage(text) {
  if (!text.trim() || store.state.streaming) return;
  const { track, userId } = store.state;

  const empty = document.getElementById("empty-state");
  if (empty) empty.remove();

  addMessage("user", text);
  const contentEl = addMessage("assistant", "");
  store.set({ streaming: true });
  const fullText = { v: "" };

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, track, user_id: userId }),
    });
    if (!res.ok) {
      contentEl.textContent = "请求失败：" + res.status;
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = raw.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = JSON.parse(line.slice(6));
        handleEvent(payload, contentEl, fullText);
      }
    }
  } catch (e) {
    contentEl.textContent += "\n[网络异常：" + e.message + "]";
  } finally {
    store.set({ streaming: false });
    scrollDown();
  }
}

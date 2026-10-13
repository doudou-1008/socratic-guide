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
  wrap.className = "msg " + (role === "user" ? "msg-user" : "msg-bot");

  const bubble = document.createElement("div");
  bubble.className = "bubble " + (role === "user" ? "bubble-user" : "bubble-bot");

  const content = document.createElement("div");
  content.className = "msg-content";
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
  el.className = "empty-state";
  el.innerHTML =
    '<div class="empty-title">我是苏格拉底式导师</div>' +
    '<div class="empty-sub">只提问、不回答。说说你卡在哪里？</div>';
  chatEl.appendChild(el);
}

export function renderHistory(history) {
  chatEl.innerHTML = "";
  if (!history || history.length === 0) {
    showEmpty();
    return;
  }
  history.forEach((m) => {
    const content = addMessage(m.role === "user" ? "user" : "assistant", "");
    renderContent(content, m.content || "");
  });
}

// 工具结果（如 Judge0）以卡片展示
function showTool(payload) {
  const wrap = document.createElement("div");
  wrap.className = "msg msg-bot";
  const card = document.createElement("div");
  card.className = "tool-card";
  const title = document.createElement("div");
  title.className = "tool-title";
  title.textContent = (payload.name || "tool") + " 运行结果";
  const pre = document.createElement("pre");
  pre.className = "tool-pre";
  pre.textContent =
    (payload.stdout || "") + (payload.stderr ? "\n[stderr]\n" + payload.stderr : "");
  card.appendChild(title);
  card.appendChild(pre);
  wrap.appendChild(card);
  chatEl.appendChild(wrap);
  scrollDown();
}

// 错误卡片 + 重试按钮
function showError(message, retryText) {
  const wrap = document.createElement("div");
  wrap.className = "msg msg-bot";
  const card = document.createElement("div");
  card.className = "error-card";
  const p = document.createElement("div");
  p.className = "error-msg";
  p.textContent = message;
  const btn = document.createElement("button");
  btn.className = "retry-btn";
  btn.textContent = "重试";
  btn.onclick = () => {
    wrap.remove();
    if (retryText) sendMessage(retryText);
  };
  card.appendChild(p);
  card.appendChild(btn);
  wrap.appendChild(card);
  chatEl.appendChild(wrap);
  scrollDown();
}

function makeTyping() {
  const span = document.createElement("span");
  span.className = "typing";
  span.innerHTML = "<i></i><i></i><i></i>";
  return span;
}

export async function sendMessage(text) {
  if (!text.trim() || store.state.streaming) return;
  const { track, userId } = store.state;

  const empty = document.getElementById("empty-state");
  if (empty) empty.remove();

  addMessage("user", text);

  const contentEl = addMessage("assistant", "");
  const typing = makeTyping();
  contentEl.appendChild(typing);
  store.set({ streaming: true });
  const fullText = { v: "" };
  let gotToken = false;

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, track, user_id: userId }),
    });
    if (!res.ok) {
      typing.remove();
      showError("请求失败（" + res.status + "），请稍后重试。", text);
      store.set({ streaming: false });
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
        switch (payload.type) {
          case "token":
            if (!gotToken) {
              gotToken = true;
              typing.remove();
            }
            fullText.v += payload.content;
            contentEl.textContent = fullText.v; // 流式阶段用纯文本，done 时再高亮
            scrollDown();
            break;
          case "stage":
            setStage(track, payload.stage, payload.label);
            break;
          case "tool":
            showTool(payload);
            break;
          case "error":
            contentEl.textContent += "\n[错误：" + payload.message + "]";
            break;
          case "done":
            if (!gotToken) typing.remove();
            renderContent(contentEl, fullText.v); // 完成后再做代码高亮
            break;
        }
      }
    }
  } catch (e) {
    if (!gotToken) typing.remove();
    showError("网络异常：" + e.message, text);
  } finally {
    store.set({ streaming: false });
    scrollDown();
  }
}

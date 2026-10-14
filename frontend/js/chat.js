// 聊天渲染 + 发消息（SSE 流）；后端未连时本地演示降级
import { store, API_BASE, TRACKS, getActive, appendMessage, setActiveStage, deriveTitle } from "./store.js";
import { renderProgress, setStage } from "./progress.js";
import { setAccent, renderContent } from "./highlight.js";

const chatEl = document.getElementById("chat");

function trackName(id) {
  const t = TRACKS.find((x) => x.id === id);
  return t ? t.name : "苏格拉底导师";
}

function scrollDown() { chatEl.scrollTop = chatEl.scrollHeight; }

function addMessage(role, text = "", delay = 0) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + (role === "user" ? "msg-user" : "msg-bot") + " msg-in";
  wrap.style.animationDelay = delay + "ms";
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

const SUGGESTIONS = {
  programming: ["报错信息看不懂", "循环一直死循环", "接口返回 500"],
  thesis: ["不知道论文立什么论", "文献太多理不清", "框架搭不起来"],
  habit: ["想坚持早起但总失败", "目标总是完不成", "容易半途而废"],
};

export function showEmpty() {
  const el = document.createElement("div");
  el.id = "empty-state";
  el.className = "empty-hero";
  const t = TRACKS.find((x) => x.id === store.state.track);
  const sugg = SUGGESTIONS[store.state.track] || SUGGESTIONS.programming;
  const chips = sugg.map((s) => '<button class="chip" type="button">' + s + "</button>").join("");
  el.innerHTML =
    (t ? '<div class="empty-badge"><span class="empty-badge-dot" style="background:' + t.color + '"></span>' + t.name + "</div>" : "") +
    '<div class="empty-title">我是苏格拉底式导师</div>' +
    '<div class="empty-sub">只提问、不回答。说说你卡在哪里？</div>' +
    '<div class="empty-hint">试试这样问</div>' +
    '<div class="chip-row">' + chips + "</div>";
  chatEl.appendChild(el);
  el.querySelectorAll(".chip").forEach((b) => {
    b.onclick = () => {
      const input = document.getElementById("input");
      input.value = b.textContent;
      input.focus();
    };
  });
}

export function openConversation() {
  const c = getActive();
  const main = document.querySelector(".chat-main");
  if (c) store.set({ track: c.track });
  applyAccentNow();
  const titleEl = document.getElementById("track-title");
  if (titleEl) titleEl.textContent = c ? (c.title || trackName(c.track)) : trackName(store.state.track);
  if (!c || c.messages.length === 0) {
    chatEl.innerHTML = "";
    showEmpty();
    if (main) main.classList.add("is-empty");
    renderProgress(store.state.track, c ? c.stage : 1);
    return;
  }
  renderHistory(c.messages);
  if (main) main.classList.remove("is-empty");
  renderProgress(c.track, c.stage);
  scrollDown();
}

function applyAccentNow() {
  const t = TRACKS.find((x) => x.id === store.state.track);
  if (t) setAccent(t.color);
}

export function renderHistory(history) {
  chatEl.innerHTML = "";
  if (!history || history.length === 0) { showEmpty(); return; }
  history.forEach((m, i) => {
    const content = addMessage(m.role === "user" ? "user" : "assistant", "", Math.min(i * 30, 240));
    renderContent(content, m.content || "");
  });
}

// 工具结果卡片
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
  pre.textContent = (payload.stdout || "") + (payload.stderr ? "\n[stderr]\n" + payload.stderr : "");
  card.appendChild(title);
  card.appendChild(pre);
  wrap.appendChild(card);
  chatEl.appendChild(wrap);
  scrollDown();
}

// 错误卡片 + 重试
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
  btn.onclick = () => { wrap.remove(); if (retryText) sendMessage(retryText); };
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

// 本地演示反问（后端未连时用于查看交互效果）
const DEMO_REPLIES = {
  programming: [
    "先别急着想答案。能具体说说：这个报错是在哪一步出现的？完整的报错信息是什么？",
    "好，我们一步步来。你觉得这段代码的「预期结果」和「实际结果」差在哪里？",
    "这个现象你之前试过什么办法吗？结果怎么样？",
  ],
  thesis: [
    "我们先把问题想清楚：你最想让读者同意的一个观点是什么？",
    "你手头的这些材料，哪一个最能支撑你的核心论点？为什么？",
    "如果只能保留三段论证，你会留哪三段？",
  ],
  habit: [
    "我们先拆解一下：你上一次没能坚持，是在哪个具体的环节断掉的？",
    "如果给「失败的那一刻」提前设一个提醒或替代动作，你会设什么？",
    "你觉得这个目标，是「太难」还是「不够具体」？",
  ],
};
function pickDemoReply(track) {
  const arr = DEMO_REPLIES[track] || DEMO_REPLIES.programming;
  return arr[Math.floor(Math.random() * arr.length)];
}
function demoRespond(contentEl) {
  const typing = makeTyping();
  contentEl.appendChild(typing);
  const reply = pickDemoReply(store.state.track);
  return new Promise((resolve) => {
    setTimeout(() => {
      typing.remove();
      let i = 0;
      const timer = setInterval(() => {
        i += 2;
        contentEl.textContent = reply.slice(0, i);
        scrollDown();
        if (i >= reply.length) { clearInterval(timer); resolve(); }
      }, 16);
    }, 550);
  });
}

export async function sendMessage(text) {
  if (!text.trim() || store.state.streaming) return;
  const { track, userId } = store.state;
  const main = document.querySelector(".chat-main");
  const empty = document.getElementById("empty-state");
  if (empty) empty.remove();
  if (main) main.classList.remove("is-empty");

  addMessage("user", text);
  appendMessage("user", text);
  updateSidebarTitle();

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
      body: JSON.stringify({ message: text, track, user_id: userId, conversation_id: store.state.activeId }),
    });
    if (!res.ok) throw new Error("status " + res.status);
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
            if (!gotToken) { gotToken = true; typing.remove(); }
            fullText.v += payload.content;
            contentEl.textContent = fullText.v;
            scrollDown();
            break;
          case "stage":
            setStage(track, payload.stage, payload.label);
            setActiveStage(payload.stage);
            break;
          case "tool": showTool(payload); break;
          case "error": contentEl.textContent += "\n[错误：" + payload.message + "]"; break;
          case "done":
            if (!gotToken) typing.remove();
            renderContent(contentEl, fullText.v);
            break;
        }
      }
    }
    if (!gotToken) typing.remove();
    if (fullText.v) appendMessage("assistant", fullText.v);
  } catch (e) {
    // 演示降级：后端未连接时，本地生成苏格拉底式反问，方便查看交互效果
    await demoRespond(contentEl);
    appendMessage("assistant", contentEl.textContent);
  } finally {
    store.set({ streaming: false });
    scrollDown();
  }
}

// 把「自动总结出来的标题」同步到左栏当前对话项（如左栏未订阅重绘时的兜底）
function updateSidebarTitle() {
  const c = getActive();
  if (!c) return;
  const el = document.querySelector(".conv-item.active .conv-title");
  if (el) el.textContent = c.title || "新对话";
}

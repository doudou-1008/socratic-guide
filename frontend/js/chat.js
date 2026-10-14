// 聊天渲染 + 发消息（SSE 流）；后端未连时本地演示降级
// 本文件同时负责：输入框交互（Enter 发送 / Shift+Enter 换行 / 停止生成）、单条复制、分享卡片。
import { store, API_BASE, TRACKS, getActive, appendMessage, setActiveStage, deriveTitle } from "./store.js";
import { renderProgress, setStage } from "./progress.js";
import { setAccent, renderContent } from "./highlight.js";

const chatEl = document.getElementById("chat");

// —— 流式中断状态（点「停止」时置位）——
let streamingStop = false;
let activeTimer = null;
let activeAbort = null;

function trackName(id) {
  const t = TRACKS.find((x) => x.id === id);
  return t ? t.name : "苏格拉底导师";
}
function scrollDown() { chatEl.scrollTop = chatEl.scrollHeight; }

function addMessage(role, text = "", delay = 0, idx = -1) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + (role === "user" ? "msg-user" : "msg-bot") + " msg-in";
  wrap.style.animationDelay = delay + "ms";
  if (idx >= 0) wrap.dataset.msgIdx = String(idx);
  const bubble = document.createElement("div");
  bubble.className = "bubble " + (role === "user" ? "bubble-user" : "bubble-bot");
  const content = document.createElement("div");
  content.className = "msg-content";
  if (text) renderContent(content, text);
  bubble.appendChild(content);
  // 复制单条按钮（hover 时显示）
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "copy-btn";
  copy.textContent = "复制";
  copy.setAttribute("aria-label", "复制这条消息");
  copy.onclick = (e) => { e.stopPropagation(); copyText(bubble.querySelector(".msg-content").innerText || ""); flashBtn(copy, "已复制"); };
  bubble.appendChild(copy);
  wrap.appendChild(bubble);
  chatEl.appendChild(wrap);
  scrollDown();
  return content;
}

function copyText(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); return; } } catch {}
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch {}
  ta.remove();
}
function flashBtn(el, msg) {
  if (!el) return;
  const old = el.textContent;
  el.textContent = msg;
  setTimeout(() => { el.textContent = old; }, 1200);
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
      if (input.tagName === "TEXTAREA") { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 200) + "px"; }
    };
  });
}

function refreshPath() {
  const c = getActive();
  if (c) renderProgress(c.track, c.stage, c);
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
    renderProgress(store.state.track, c ? c.stage : 1, null);
    return;
  }
  renderHistory(c.messages);
  if (main) main.classList.remove("is-empty");
  renderProgress(c.track, c.stage, c);
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
    const content = addMessage(m.role === "user" ? "user" : "assistant", "", Math.min(i * 30, 240), i);
    renderContent(content, m.content || "");
  });
}

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
      if (streamingStop) { typing.remove(); resolve(); return; }
      typing.remove();
      let i = 0;
      activeTimer = setInterval(() => {
        if (streamingStop) { clearInterval(activeTimer); activeTimer = null; resolve(); return; }
        i += 2;
        contentEl.textContent = reply.slice(0, i);
        scrollDown();
        if (i >= reply.length) { clearInterval(activeTimer); activeTimer = null; resolve(); }
      }, 16);
    }, 550);
  });
}

function stopStreaming() {
  streamingStop = true;
  if (activeAbort) { try { activeAbort.abort(); } catch {} }
  if (activeTimer) { clearInterval(activeTimer); activeTimer = null; }
}

export async function sendMessage(text) {
  if (!text.trim() || store.state.streaming) return;
  const { track, userId } = store.state;
  const main = document.querySelector(".chat-main");
  const empty = document.getElementById("empty-state");
  if (empty) empty.remove();
  if (main) main.classList.remove("is-empty");

  streamingStop = false;
  setBusy(true);
  const idxUser = (getActive().messages || []).length;
  addMessage("user", text, 0, idxUser);
  appendMessage("user", text);
  updateSidebarTitle();
  refreshPath();

  const idxBot = (getActive().messages || []).length;
  const contentEl = addMessage("assistant", "", 0, idxBot);
  const typing = makeTyping();
  contentEl.appendChild(typing);
  store.set({ streaming: true });
  const fullText = { v: "" };
  let gotToken = false;

  try {
    const ac = new AbortController();
    activeAbort = ac;
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, track, user_id: userId, conversation_id: store.state.activeId }),
      signal: ac.signal,
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
    if (typing && typing.parentNode) typing.remove();
    // 用户主动停止时不降级；否则演示降级：本地生成苏格拉底式反问
    if (!streamingStop) {
      await demoRespond(contentEl);
      appendMessage("assistant", contentEl.textContent);
    }
  } finally {
    store.set({ streaming: false });
    activeAbort = null;
    setBusy(false);
    scrollDown();
    refreshPath();
  }
}

function setBusy(busy) {
  const btn = document.getElementById("send");
  if (!btn) return;
  if (busy) { btn.textContent = "停止"; btn.onclick = stopStreaming; btn.classList.add("is-stop"); }
  else { btn.textContent = "发送"; btn.onclick = doSend; btn.classList.remove("is-stop"); }
}

function doSend() {
  if (store.state.streaming) return;
  const input = document.getElementById("input");
  if (!input) return;
  const v = input.value;
  if (!v.trim()) return;
  input.value = "";
  input.style.height = "auto";
  sendMessage(v);
}

// 输入框交互（textarea 多行 / Enter 发送 / Shift+Enter 换行 / 自动增高）
export function initComposer() {
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");
  if (!input || !sendBtn) return;
  function autoGrow() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 200) + "px"; }
  input.addEventListener("input", autoGrow);
  sendBtn.onclick = doSend;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); }
  });
}

// —— 自动总结标题同步到左栏（兜底）——
function updateSidebarTitle() {
  const c = getActive();
  if (!c) return;
  const el = document.querySelector(".conv-item.active .conv-title");
  if (el) el.textContent = c.title || "新对话";
}

// —— 对话导出为 Markdown ——
export function exportConversation() {
  const c = getActive();
  if (!c || !c.messages || !c.messages.length) { flashBtn(document.getElementById("export-btn"), "请先聊天"); return; }
  const t = TRACKS.find((x) => x.id === c.track);
  const trackName = t ? t.name : "";
  const dateStr = new Date(c.createdAt || Date.now()).toLocaleString("zh-CN");
  let md = "# " + (c.title || "苏格拉底式对话") + "\n\n";
  md += "> 赛道：" + trackName + "　|　时间：" + dateStr + "\n\n---\n\n";
  c.messages.forEach((m) => {
    const who = m.role === "user" ? "你" : "导师";
    md += "**" + who + "：**\n\n" + (m.content || "") + "\n\n";
  });
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fname = (c.title || "对话").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "对话";
  a.download = fname + ".md";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// —— 分享卡片（canvas 生成 PNG）——
export function shareCard() {
  const c = getActive();
  if (!c || !c.messages || !c.messages.length) { flashBtn(document.getElementById("share-btn"), "请先聊天"); return; }
  const t = TRACKS.find((x) => x.id === c.track);
  const trackName = t ? t.name : "";
  const accent = t ? t.color : "#2563eb";
  const msgs = c.messages.slice(0, 14);
  const W = 720, padX = 44, padTop = 56, lineH = 30, labelH = 24, msgGap = 22;
  const FONT_LABEL = '600 15px "PingFang SC","Microsoft YaHei",sans-serif';
  const FONT_BODY = '400 17px "PingFang SC","Microsoft YaHei",sans-serif';

  const cv = document.createElement("canvas");
  const ratio = window.devicePixelRatio || 1;
  const ctx = cv.getContext("2d");
  ctx.font = FONT_BODY;
  let H = padTop + 64;
  const heights = msgs.map((m) => {
    const lines = wrapText(ctx, m.content || "", W - padX * 2).slice(0, 3).length;
    return labelH + lines * lineH;
  });
  H += heights.reduce((a, b) => a + b + msgGap, 0) + 56;

  cv.width = W * ratio; cv.height = H * ratio;
  ctx.scale(ratio, ratio);
  // 背景
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  // 顶部品牌
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(padX + 6, padTop - 14 + 6, 7, 0, Math.PI * 2); ctx.fill();
  ctx.font = '700 22px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = "#171717";
  ctx.fillText("苏格拉底导师", padX + 22, padTop - 8);
  ctx.font = '500 14px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = "#9ca3af";
  ctx.fillText("「" + (c.title || "对话") + "」", padX + 22, padTop + 14);
  ctx.fillText("赛道：" + trackName, W - padX - ctx.measureText("赛道：" + trackName).width, padTop + 14);

  let y = padTop + 56;
  msgs.forEach((m, k) => {
    const who = m.role === "user" ? "你" : "导师";
    ctx.font = FONT_LABEL;
    ctx.fillStyle = m.role === "user" ? "#6b6b6b" : accent;
    ctx.fillText(who, padX, y);
    y += labelH;
    ctx.font = FONT_BODY;
    ctx.fillStyle = "#171717";
    const lines = wrapText(ctx, m.content || "", W - padX * 2).slice(0, 3);
    lines.forEach((ln) => { ctx.fillText(ln, padX, y); y += lineH; });
    if (k < msgs.length - 1) y += msgGap;
  });
  // 底部
  ctx.font = '500 13px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = "#bdbdbd";
  ctx.fillText("苏格拉底导师 · 只提问 · 不回答　" + new Date(c.createdAt || Date.now()).toLocaleDateString("zh-CN"), padX, H - 28);

  cv.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fname = (c.title || "对话").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "对话";
    a.href = url; a.download = fname + ".png";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = "";
  const str = String(text || "");
  for (const ch of str) {
    if (ch === "\n") { lines.push(line); line = ""; continue; }
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = ch; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

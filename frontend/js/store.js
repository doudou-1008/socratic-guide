// 前端全局状态（多会话版）
// 每赛道可有多条对话；当前用 localStorage 管理，后端 conversation_id 对接点见 fetchSession。

export const API_BASE = "http://127.0.0.1:8000";

// 三赛道展示配置（id 必须与后端一致）；强调色均非 AI 紫、饱和度 < 80%
export const TRACKS = [
  { id: "programming", name: "编程排错", color: "#2563eb" },
  { id: "thesis",     name: "论文写作", color: "#0d9488" },
  { id: "habit",      name: "自律习惯", color: "#f59e0b" },
];

// 跨刷新保留 userId
const UID_KEY = "socratic_user_id";
function loadUserId() {
  try {
    let id = localStorage.getItem(UID_KEY);
    if (!id) { id = newId(); localStorage.setItem(UID_KEY, id); }
    return id;
  } catch { return newId(); }
}

// 多会话持久化
const CONV_KEY = "socratic_conversations_v1";
function loadConversations() {
  try {
    const raw = localStorage.getItem(CONV_KEY);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a)) {
        // 清理历史遗留的空壳对话：一条消息都没有的（标题仍是「新对话」）直接丢弃，
        // 顺手把旧数据里没写好的标题按内容补正，保证列表里只剩"真聊过"的对话。
        return a
          .filter((c) => c && Array.isArray(c.messages) && c.messages.length > 0)
          .map((c) => {
            if ((!c.title || c.title === "新对话") && c.messages.some((m) => m.role === "user")) {
              c.title = deriveTitle(c.messages);
            }
            return c;
          });
      }
    }
  } catch {}
  return [];
}
function saveConversations(list) {
  try { localStorage.setItem(CONV_KEY, JSON.stringify(list)); } catch {}
}

// —— 标题：根据对话内容自动总结（本地摘要）——
// 首条消息通常最凝练，作为主干；若首条太短，再借第二条补充关键信息；最后智能截断到 18 字。
// 后端接入后可由 A 的接口返回更聪明的标题，这里作为无后端时的可靠兜底。
const FILLER_HEAD = /^(?:你好|您好|嗨|哈喽|hello|hi|请问|请教|麻烦|劳驾|帮我|帮忙|我想问|我想知道|我想了解|我想|想问问|想问下|问一下|能不能|可否|可以|能否|请|那个|就是|嗯|呃|额)+[，,。、！!？?\s]*/i;
const FILLER_TAIL = /(?:谢谢|多谢|感谢|拜托|啦|哦|呀|啊|呢|吧|吗|哈|了)+\s*$/;
const FILLER_MID = /(?:怎么办|怎么搞|怎么弄|如何是好|什么情况|是什么原因|为什么会这样)/g;

export function deriveTitle(messages) {
  const users = (messages || [])
    .filter((m) => m.role === "user")
    .map((m) => String(m.content || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!users.length) return "新对话";

  const clean = (s) => s.replace(FILLER_HEAD, "").replace(FILLER_TAIL, "").replace(FILLER_MID, "").trim();
  let title = clean(users[0]) || users[0];

  if (users[1] && title.length < 12) {
    const core = clean(users[1]).split(/[。！？!?；;\n]/)[0].trim();
    if (core.length >= 4) title = title + "：" + core;
  }

  title = title.replace(/[，。！？、；：,.!?;:]+$/g, "").trim();
  const MAX = 18;
  if (title.length > MAX) {
    const seg = title.slice(0, MAX + 1);
    const cut = Math.max(seg.lastIndexOf("，"), seg.lastIndexOf("。"), seg.lastIndexOf("、"), seg.lastIndexOf(" "));
    title = (cut >= 6 ? seg.slice(0, cut) : title.slice(0, MAX)).trim() + "…";
  }
  return title || "新对话";
}

function newId() {
  try { return crypto.randomUUID(); }
  catch { return "c" + Date.now() + Math.random().toString(36).slice(2); }
}

// 尚未输入任何内容的「临时空对话」，不计入持久化列表，切走/刷新即丢弃
let pending = null;

export const store = {
  state: {
    userId: loadUserId(),
    track: "programming",
    conversations: loadConversations(),
    activeId: null,
    streaming: false,
  },
  listeners: [],
  subscribe(fn) { this.listeners.push(fn); },
  set(patch) { Object.assign(this.state, patch); this.listeners.forEach((f) => f(this.state)); },
};

export function getActive() {
  if (pending && pending.id === store.state.activeId) return pending;
  return store.state.conversations.find((c) => c.id === store.state.activeId) || null;
}
export function conversationsOf(track) {
  return store.state.conversations.filter((c) => c.track === track);
}

export function newConversation(track) {
  track = track || store.state.track;
  const conv = { id: newId(), track, title: "新对话", messages: [], stage: 1, createdAt: Date.now() };
  pending = conv; // 临时，未输入前不写入列表
  store.set({ activeId: conv.id, track: conv.track });
  return conv;
}

// 把临时空对话正式写入列表并持久化（在用户发出第一条消息时调用）
function commitPending() {
  if (!pending) return;
  const list = [pending, ...store.state.conversations];
  pending = null;
  store.set({ conversations: list });
  saveConversations(list);
}

// 仅切换赛道：丢弃临时空对话，不新建
export function focusTrack(track) {
  pending = null;
  store.set({ track, activeId: null });
}

export function selectConversation(id) {
  pending = null;
  const c = store.state.conversations.find((x) => x.id === id);
  if (!c) return;
  store.set({ activeId: id, track: c.track });
}

export function deleteConversation(id) {
  if (pending && pending.id === id) pending = null;
  const list = store.state.conversations.filter((c) => c.id !== id);
  let activeId = store.state.activeId;
  if (activeId === id) {
    const next = list.find((c) => c.track === store.state.track) || list[0] || null;
    activeId = next ? next.id : null;
  }
  store.set({ conversations: list, activeId });
  saveConversations(list);
}

export function appendMessage(role, content) {
  let c = getActive();
  if (!c) c = newConversation();           // 没有活动对话时自动开一条（仍是临时，发出首条消息才落库）
  c.messages.push({ role, content });
  if (role === "user") {
    const n = c.messages.filter((m) => m.role === "user").length;
    if (n === 1) c.title = deriveTitle(c.messages);   // 自动总结出标题
  }
  if (pending && role === "user") commitPending();     // 首条消息落库，空对话不进入列表
  else saveConversations(store.state.conversations);
}

export function setActiveStage(stage) {
  const c = getActive();
  if (c) { c.stage = stage; saveConversations(store.state.conversations); }
}

// 后端对接预留：等 A 的 /session 支持 conversation_id 后启用（本地仍作为真相源）
export async function fetchSession(track, conversationId) {
  try {
    let url = `${API_BASE}/session?user_id=${encodeURIComponent(store.state.userId)}&track=${encodeURIComponent(track)}`;
    if (conversationId) url += `&conversation_id=${encodeURIComponent(conversationId)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

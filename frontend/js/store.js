// 前端全局状态（骨架）—— 零框架，发布订阅。
// 只存"界面态"，权威对话历史以后端数据库为准（通过 GET /session 拉取）。

// 后端地址：本地联调用 http://127.0.0.1:8000
// 上线后由 B 改成 A 部署的后端公网地址（见分工手册 任务8）
export const API_BASE = "http://127.0.0.1:8000";

// 三赛道展示配置（id 必须与后端 TRACKS 的 key 一致）
export const TRACKS = [
  { id: "programming", name: "编程排错", icon: "💻", color: "#3b82f6" },
  { id: "thesis",     name: "论文写作", icon: "📝", color: "#8b5cf6" },
  { id: "habit",      name: "自律习惯", icon: "🌱", color: "#10b981" },
];

// 跨刷新保留 userId，使历史可以拉回（localStorage 持久化）
const UID_KEY = "socratic_user_id";
function loadUserId() {
  try {
    let id = localStorage.getItem(UID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(UID_KEY, id);
    }
    return id;
  } catch {
    // 隐私模式 / 无 localStorage 时降级：每次会话新建
    return crypto.randomUUID();
  }
}

export const store = {
  state: {
    userId: loadUserId(),
    track: "programming",
    stage: {},
    streaming: false,
    messages: [],
  },
  listeners: [],
  subscribe(fn) { this.listeners.push(fn); },
  set(patch) {
    Object.assign(this.state, patch);
    this.listeners.forEach((f) => f(this.state));
  },
};

// 拉取某赛道历史与当前阶段（B-任务3 调用）
// 后端返回结构：{ stage: int, history: [{ role, content }] }
export async function fetchSession(track) {
  try {
    const res = await fetch(
      `${API_BASE}/session?user_id=${encodeURIComponent(store.state.userId)}` +
      `&track=${encodeURIComponent(track)}`
    );
    if (!res.ok) return { stage: 1, history: [] };
    return await res.json();
  } catch {
    // 后端没起 / 网络异常时，降级为空白会话，前端不崩
    return { stage: 1, history: [] };
  }
}

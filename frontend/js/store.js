// 前端全局状态（骨架）—— 零框架，发布订阅。
// 只存"界面态"，权威对话历史以后端数据库为准（通过 GET /session 拉取）。

export const store = {
  state: {
    userId: crypto.randomUUID(),   // 首次访问生成，localStorage 持久化
    track: 'programming',
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

// 切赛道 / 刷新页面时拉回历史（B-任务3 调用）
// const s = await (await fetch(`/session?user_id=${store.state.userId}&track=${t}`)).json();
// store.set({ track: t, stage: { [t]: s.stage }, messages: s.history });

// 进度条 + 引导树（接 stage 事件点亮节点）
import { store } from "./store.js";

export const STAGE_MAP = {
  programming: ["定位错误", "分析原因", "给出方案"],
  thesis: ["明确立场", "寻找论据", "搭建框架"],
  habit: ["拆解目标", "预设障碍", "制定策略"],
};

export function renderProgress(track, stage) {
  const el = document.getElementById("progress");
  if (!el) return;
  const labels = STAGE_MAP[track];
  el.innerHTML = "";
  labels.forEach((label, i) => {
    const n = i + 1;
    const row = document.createElement("div");
    row.className = "prog-row";

    const dot = document.createElement("div");
    dot.className = "prog-dot" + (n <= stage ? " done" : "");
    dot.textContent = n;

    const txt = document.createElement("div");
    txt.className = "prog-label" + (n <= stage ? " done" : "");
    txt.textContent = label;

    row.appendChild(dot);
    row.appendChild(txt);
    el.appendChild(row);
  });
}

export function setStage(track, stage, label) {
  store.set({ stage: { ...store.state.stage, [track]: stage } });
  renderProgress(track, stage);
}

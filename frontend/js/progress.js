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
    const node = document.createElement("div");
    node.className = "flex items-center gap-3 mb-4";

    const dot = document.createElement("div");
    dot.className =
      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold " +
      (n <= stage ? "bg-accent text-white" : "bg-gray-200 text-gray-500");
    dot.textContent = n;

    const txt = document.createElement("div");
    txt.className =
      "text-sm " + (n <= stage ? "font-semibold text-gray-800" : "text-gray-400");
    txt.textContent = label;

    node.appendChild(dot);
    node.appendChild(txt);
    el.appendChild(node);
  });
}

export function setStage(track, stage, label) {
  store.set({ stage: { ...store.state.stage, [track]: stage } });
  renderProgress(track, stage);
}

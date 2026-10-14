// 进度条 + 引导树（接 stage 事件点亮节点）
import { store, TRACKS } from "./store.js";

export const STAGE_MAP = {
  programming: ["定位错误", "分析原因", "给出方案"],
  thesis: ["明确立场", "寻找论据", "搭建框架"],
  habit: ["拆解目标", "预设障碍", "制定策略"],
};

// 各赛道的一句话说明（填充右侧面板）
const TRACK_DESC = {
  programming: "陪你把报错一层层定位到根因，而不是直接给答案。",
  thesis: "帮你把模糊的想法，逼成一个站得住脚的论点。",
  habit: "和你一起拆解「坚持不下去」到底卡在哪一步。",
};

export function renderProgress(track, stage) {
  const el = document.getElementById("progress");
  if (!el) return;
  const labels = STAGE_MAP[track] || STAGE_MAP.programming;
  const meta = TRACKS.find((x) => x.id === track);
  el.innerHTML = "";

  // 当前赛道说明
  if (meta) {
    const head = document.createElement("div");
    head.className = "prog-track";
    head.innerHTML =
      '<span class="prog-track-dot" style="background:' + meta.color + '"></span>' +
      '<span class="prog-track-name">' + meta.name + "</span>" +
      '<p class="prog-track-desc">' + (TRACK_DESC[track] || "") + "</p>";
    el.appendChild(head);
  }

  labels.forEach((label, i) => {
    const n = i + 1;
    const done = n <= stage;
    const row = document.createElement("div");
    row.className = "prog-row" + (done ? " done" : "");

    const dot = document.createElement("div");
    dot.className = "prog-dot" + (done ? " done" : "");
    dot.textContent = n;

    const txt = document.createElement("div");
    txt.className = "prog-label" + (done ? " done" : "");
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

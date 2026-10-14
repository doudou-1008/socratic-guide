// 进度概览 + 思考路径图（引导链）
import { store, TRACKS } from "./store.js";

export const STAGE_MAP = {
  programming: ["定位错误", "分析原因", "给出方案"],
  thesis: ["明确立场", "寻找论据", "搭建框架"],
  habit: ["拆解目标", "预设障碍", "制定策略"],
  daily: ["说清琐事", "厘清想法", "自己定夺"],
};

const TRACK_DESC = {
  programming: "陪你把报错一层层定位到根因，而不是直接给答案。",
  thesis: "帮你把模糊的想法，逼成一个站得住脚的论点。",
  habit: "和你一起拆解「坚持不下去」到底卡在哪一步。",
  daily: "陪你梳理生活里的小纠结，问着问着你就想明白了。",
};

function summarize(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

export function renderProgress(track, stage, conv) {
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

  // 三阶段概览（小药丸）
  const steps = document.createElement("div");
  steps.className = "prog-steps";
  labels.forEach((label, i) => {
    const done = i + 1 <= (stage || 1);
    const s = document.createElement("span");
    s.className = "prog-step" + (done ? " done" : "");
    s.textContent = label;
    steps.appendChild(s);
  });
  el.appendChild(steps);

  // 引导链：把导师的提问串成可跳转的节点
  const chain = document.createElement("div");
  chain.className = "path-chain";
  const msgs = (conv && conv.messages) || [];
  if (!msgs.length) {
    const tip = document.createElement("div");
    tip.className = "path-empty";
    tip.textContent = "开始对话后，这里会显示导师的引导路径。";
    chain.appendChild(tip);
  } else {
    let i = 0, no = 0;
    while (i < msgs.length) {
      const m = msgs[i];
      if (m.role === "user" && msgs[i + 1] && msgs[i + 1].role === "assistant") {
        no++;
        chain.appendChild(makeStep(no, msgs[i + 1], msgs[i], i + 1));
        i += 2;
      } else if (m.role === "assistant") {
        no++;
        chain.appendChild(makeStep(no, m, null, i));
        i += 1;
      } else {
        i += 1;
      }
    }
  }
  el.appendChild(chain);
}

function makeStep(no, q, a, qIdx) {
  const step = document.createElement("div");
  step.className = "path-step";
  const head = document.createElement("div");
  head.className = "path-no";
  head.textContent = no;
  const qEl = document.createElement("div");
  qEl.className = "path-q";
  qEl.textContent = summarize(q.content, 46);
  step.appendChild(head);
  step.appendChild(qEl);
  if (a && a.content) {
    const ans = document.createElement("div");
    ans.className = "path-a";
    ans.textContent = "你：" + summarize(a.content, 34);
    step.appendChild(ans);
  }
  step.addEventListener("click", () => jumpTo(qIdx));
  return step;
}

function jumpTo(idx) {
  const node = document.querySelector('[data-msg-idx="' + idx + '"]');
  if (!node) return;
  node.scrollIntoView({ behavior: "smooth", block: "center" });
  node.classList.add("msg-flash");
  setTimeout(() => node.classList.remove("msg-flash"), 900);
}

export function setStage(track, stage, label) {
  store.set({ stage: { ...store.state.stage, [track]: stage } });
  const c = store.state.conversations.find((x) => x.id === store.state.activeId);
  renderProgress(track, stage, c);
}

// 赛道切换 UI：侧边栏三标签 + 主题色 + 拉历史
import { store, fetchSession, TRACKS } from "./store.js";
import { renderProgress } from "./progress.js";
import { setAccent } from "./highlight.js";
import { renderHistory } from "./chat.js";

export function renderTracks() {
  const bar = document.getElementById("track-bar");
  bar.innerHTML = "";
  TRACKS.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "track-btn";
    btn.dataset.track = t.id;

    const dot = document.createElement("span");
    dot.className = "track-dot";
    dot.style.background = t.color; // 赛道标识色（非 AI 紫）

    const label = document.createElement("span");
    label.className = "track-name";
    label.textContent = t.name;

    btn.appendChild(dot);
    btn.appendChild(label);
    btn.onclick = () => switchTrack(t.id);
    bar.appendChild(btn);
  });
  applyActive();
}

function applyActive() {
  const t = TRACKS.find((x) => x.id === store.state.track);
  setAccent(t.color);
  document.querySelectorAll(".track-btn").forEach((b) => {
    const active = b.dataset.track === store.state.track;
    b.classList.toggle("active", active);
    b.style.borderColor = active ? t.color : "transparent";
    b.style.background = active ? t.color + "14" : ""; // 透明底色，避免纯色块
  });
  const title = document.getElementById("track-title");
  if (title) title.textContent = t.name;
}

export async function switchTrack(track) {
  if (store.state.streaming) return;
  store.set({ track });
  applyActive();
  const s = await fetchSession(track);
  store.set({
    stage: { ...store.state.stage, [track]: s.stage },
    messages: s.history,
  });
  renderProgress(track, s.stage);
  renderHistory(s.history);
}

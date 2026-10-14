// 侧边栏：赛道分组（可折叠，手风琴） + 每组对话列表 + 新建/切换/删除
import {
  store, TRACKS,
  newConversation as storeNew,
  selectConversation as storeSelect,
  deleteConversation as storeDelete,
  focusTrack,
  conversationsOf,
} from "./store.js";
import { setAccent } from "./highlight.js";
import { openConversation } from "./chat.js";

// 当前展开的分组（手风琴：一次只展开一个，默认展开当前赛道）
let expandedTrack = store.state.track;

function applyAccent() {
  const t = TRACKS.find((x) => x.id === store.state.track);
  if (t) setAccent(t.color);
}

export function renderTracks() {
  syncSidebar();
  applyAccent();
}

// 让指定赛道分组展开（用于：打开某条对话时自动展开它所属的赛道）
export function expandTrack(tid) { expandedTrack = tid; }

export function syncSidebar() {
  const root = document.getElementById("conv-groups");
  if (!root) return;
  root.innerHTML = "";

  TRACKS.forEach((t) => {
    const open = expandedTrack === t.id;
    const convs = conversationsOf(t.id);

    const group = document.createElement("div");
    group.className = "conv-group";

    // —— 分组标题：点击展开 / 收起 ——
    const head = document.createElement("button");
    head.type = "button";
    head.className = "conv-group-head" + (open ? " open" : "");
    head.setAttribute("aria-expanded", open ? "true" : "false");
    head.setAttribute("aria-label", (open ? "收起" : "展开") + "「" + t.name + "」");
    head.innerHTML =
      '<span class="track-dot" style="background:' + t.color + '"></span>' +
      '<span class="conv-group-name">' + t.name + "</span>" +
      (convs.length ? '<span class="conv-count">' + convs.length + "</span>" : "");
    head.onclick = () => toggleGroup(t.id);

    // 「+」新建（悬停分组标题时才出现，减少视觉噪音）
    const add = document.createElement("span");
    add.className = "conv-group-add";
    add.setAttribute("role", "button");
    add.setAttribute("aria-label", "在「" + t.name + "」新建对话");
    add.textContent = "+";
    add.onclick = (e) => { e.stopPropagation(); expandedTrack = t.id; storeNew(t.id); afterNew(); };
    head.appendChild(add);

    // 折叠箭头
    const caret = document.createElement("span");
    caret.className = "conv-caret";
    caret.setAttribute("aria-hidden", "true");
    head.appendChild(caret);

    // —— 对话列表（折叠容器）——
    const list = document.createElement("div");
    list.className = "conv-list" + (open ? " open" : "");
    if (convs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "conv-empty";
      empty.textContent = "还没有对话";
      list.appendChild(empty);
    } else {
      convs.forEach((c) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "conv-item" + (c.id === store.state.activeId ? " active" : "");
        item.setAttribute("aria-label", "打开对话：" + (c.title || "新对话"));
        const title = document.createElement("span");
        title.className = "conv-title";
        title.textContent = c.title || "新对话";
        const del = document.createElement("span");
        del.className = "conv-del";
        del.textContent = "×";
        del.setAttribute("role", "button");
        del.setAttribute("aria-label", "删除该对话");
        del.onclick = (e) => { e.stopPropagation(); storeDelete(c.id); afterDelete(); };
        item.appendChild(title);
        item.appendChild(del);
        item.onclick = () => { storeSelect(c.id); afterSelect(); };
        list.appendChild(item);
      });
    }

    group.appendChild(head);
    group.appendChild(list);
    root.appendChild(group);
  });
}

// 展开 / 收起某个赛道：展开时切到该赛道，并打开它最近的一条对话
function toggleGroup(tid) {
  if (expandedTrack === tid) {         // 再次点击 → 收起
    expandedTrack = null;
    syncSidebar();
    return;
  }
  expandedTrack = tid;
  const list = conversationsOf(tid);
  if (list.length) storeSelect(list[0].id); // 有历史 → 打开最近一条
  else focusTrack(tid);                     // 无历史 → 空状态，不建空对话
  applyAccent();
  openConversation();
  syncSidebar();
}

export function afterNew() { expandedTrack = store.state.track; syncSidebar(); applyAccent(); openConversation(); }
export function afterSelect() { syncSidebar(); applyAccent(); openConversation(); }
export function afterDelete() { syncSidebar(); applyAccent(); openConversation(); }

# 轻量 RAG：本地 knowledge.json + 关键词匹配（不装向量库/embedding）
import json
import os

_KB = None


def _load():
    global _KB
    if _KB is None:
        path = os.path.join(os.path.dirname(__file__), "knowledge.json")
        with open(path, encoding="utf-8") as f:
            _KB = json.load(f)
    return _KB


def retrieve(track: str, text: str, top: int = 3) -> list:
    """按关键词重合度取最相关 hint，最多 top 条。"""
    kb = _load()
    items = kb.get(track, [])
    text_l = (text or "").lower()
    scored = []
    for it in items:
        score = sum(1 for kw in it.get("keywords", []) if kw.lower() in text_l)
        if score > 0:
            scored.append((score, it.get("hint", "")))
    scored.sort(key=lambda x: -x[0])
    return [h for _, h in scored[:top]]

# 苏格拉底式多赛道导师 —— 后端入口（完整版）
# 运行：uvicorn main:app --reload  （http://127.0.0.1:8000/docs）
# 未配置 DEEPSEEK_API_KEY 时自动降级为"演示模式"，仍走完整 SSE 流程，方便前端本地联调。

import os
import re
import json
import asyncio
import sqlite3
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from openai import OpenAI

from prompts import TRACKS, build_system_prompt
from rag import retrieve
from guard import soft_refuse, check_reply_leak

load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
MODEL = "deepseek-chat"
DB_PATH = os.path.join(os.path.dirname(__file__), "state.db")
TRACK_ENUMS = ["programming", "thesis", "habit", "daily"]

# ---------- CORS ----------
# 前端用 Live Server 跑在 5500；旧 3000 一并保留以兼容历史联调。
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5500,http://127.0.0.1:3000").split(",") if o.strip()]
origins += ["http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:3000", "http://localhost:3000"]

app = FastAPI(title="苏格拉底式多赛道导师")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ---------- SQLite 状态库 ----------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS session(
            user_id TEXT,
            track   TEXT,
            stage   INTEGER,
            history TEXT,
            updated_at TEXT,
            PRIMARY KEY(user_id, track))"""
    )
    conn.commit()
    conn.close()


def load_session(user_id: str, track: str):
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT stage, history FROM session WHERE user_id=? AND track=?", (user_id, track)
    ).fetchone()
    conn.close()
    if row:
        return row[0], json.loads(row[1])
    return 1, []


def save_session(user_id: str, track: str, stage: int, history: list):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """INSERT INTO session(user_id,track,stage,history,updated_at) VALUES(?,?,?,?,?)
           ON CONFLICT(user_id,track) DO UPDATE SET
             stage=excluded.stage, history=excluded.history, updated_at=excluded.updated_at""",
        (user_id, track, stage, json.dumps(history, ensure_ascii=False), datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()


init_db()

# ---------- 请求模型 ----------
class ChatReq(BaseModel):
    message: str
    track: str
    user_id: str
    history: list | None = None  # 可选，后端以数据库为准


# ---------- 工具函数 ----------
CODE_BLOCK_RE = re.compile(r"```(\w+)?\n(.*?)```", re.DOTALL)


def detect_code(message: str):
    return CODE_BLOCK_RE.findall(message or "")


def sse(event_type: str, **data) -> str:
    return "data: " + json.dumps({"type": event_type, **data}, ensure_ascii=False) + "\n\n"


def build_mock_reply(track: str, stage_label: str) -> str:
    name = TRACKS[track]["name"]
    return (
        f"（演示模式·未配置 DEEPSEEK_API_KEY）我们在「{name}」的「{stage_label}」阶段。\n"
        f"我先不给你答案，想请你思考：你目前掌握的信息里，哪一点最能帮你往前推进一步？"
    )


# ---------- 路由 ----------
@app.get("/")
def root():
    return {
        "msg": "socratic-guide backend running",
        "docs": "/docs",
        "model": "deepseek-chat" if DEEPSEEK_API_KEY else "mock(演示模式)",
    }


@app.get("/session")
def get_session(user_id: str, track: str):
    if track not in TRACK_ENUMS:
        return JSONResponse(status_code=400, content={"detail": "请求格式错误：track 不在枚举"})
    stage, history = load_session(user_id, track)
    return {"stage": stage, "history": history}


@app.post("/chat")
async def chat(req: ChatReq):
    if req.track not in TRACK_ENUMS:
        return JSONResponse(status_code=400, content={"detail": "请求格式错误：track 不在枚举"})
    if not req.message.strip():
        return JSONResponse(status_code=400, content={"detail": "请求格式错误：message 为空"})

    stage, history = load_session(req.user_id, req.track)
    track_cfg = TRACKS[req.track]
    stage_label = track_cfg["stages"][min(stage, 3) - 1]["label"]

    # 安全软拒（越狱/求答案）
    refusal = soft_refuse(req.message)
    if refusal:
        async def refuse_gen():
            for ch in refusal:
                yield sse("token", content=ch)
            yield sse("done")
        return StreamingResponse(refuse_gen(), media_type="text/event-stream")

    # RAG 检索
    rag_hints = retrieve(req.track, req.message)

    system = build_system_prompt(req.track, stage_label, rag_hints)
    messages = [{"role": "system", "content": system}]
    for m in history[-12:]:
        messages.append(m)
    messages.append({"role": "user", "content": req.message})

    code_hits = detect_code(req.message)

    async def event_gen():
        full_reply = ""
        if DEEPSEEK_API_KEY:
            try:
                client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
                stream = client.chat.completions.create(model=MODEL, messages=messages, stream=True)
                for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        full_reply += delta
                        yield sse("token", content=delta)
            except Exception as e:  # 429/500 等
                yield sse("error", message=f"服务异常：{e}")
                return
        else:
            reply = build_mock_reply(req.track, stage_label)
            leak = check_reply_leak(reply)
            if leak:
                reply += "\n" + leak
            for ch in reply:
                full_reply += ch
                yield sse("token", content=ch)
                await asyncio.sleep(0.008)

        # 工具事件：检测到代码块 -> 降级为模拟运行结果（Judge0 国内不可用）
        if code_hits:
            lang, code = code_hits[0]
            yield sse(
                "tool",
                name="judge0",
                stdout=f"【模拟运行结果·Judge0 国内不可用已降级】\n语言：{lang or 'text'}，代码字符数：{len(code)}",
                stderr="",
            )

        # 阶段推进：每完成一轮 +1，封顶 3
        new_stage = min(stage + 1, 3)
        if new_stage != stage:
            yield sse("stage", stage=new_stage, label=track_cfg["stages"][new_stage - 1]["label"])

        yield sse("done")

        # 持久化（历史以数据库为准）
        history.append({"role": "user", "content": req.message})
        if full_reply:
            history.append({"role": "assistant", "content": full_reply})
        save_session(req.user_id, req.track, new_stage, history)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

# 苏格拉底式多赛道导师（socratic-guide）

基于大模型的 Web 应用，用"只提问不回答"的苏格拉底式对话引导用户自主思考，覆盖**编程排错 / 论文写作 / 自律习惯 / 日常闲聊**四赛道，进度独立保存、切换不丢。

## 技术栈（锁定）
- 后端：Python 3.11 + FastAPI + DeepSeek API + sqlite3（单文件 `state.db`）
- 前端：原生 HTML + 原生 CSS + 原生 JS（ES Module，零框架）
- 接口：`POST /chat`（SSE 流式）+ `GET /session`（取回历史），详见 `协作文档/04_接口与约定.md`
- 部署：国内可达平台（前端 EdgeOne Pages / 后端 阿里云 FC·ECS）；严禁 Vercel/Railway

## 目录结构
```
socratic-guide/
├── backend/            # A 负责：FastAPI + /chat(SSE) + 四赛道 + sqlite + RAG + 安全
│   ├── main.py         # 入口（含无 Key 演示降级）
│   ├── prompts.py      # 四赛道 System Prompt + 阶段定义（注：当前仅 3 赛道，daily 待加）
│   ├── rag.py          # 轻量 RAG 关键词检索
│   ├── guard.py        # 安全软拒 + 破防检测
│   ├── knowledge.json  # RAG 知识库
│   ├── requirements.txt
│   └── .env.example
├── frontend/           # B(组长) 负责：聊天页 + fetch 读 SSE + 进度条 + 主题色 + OCR
│   ├── index.html
│   ├── js/  store / chat / track / progress / highlight / ocr / onboarding
│   └── package.json
├── 协作文档/           # 团队分工与协同说明（00、AGENTS 本地留档不公开）
├── docs/               # 旧版内部手册（已并入 协作文档/）
├── AGENTS.md           # 项目协作与维护说明（本地留档）
├── README.md
└── smoke.ps1           # 一键本地自检（Windows PowerShell）
```

## 本地运行
```powershell
# 后端
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # 填入 DEEPSEEK_API_KEY（不填则进入演示模式，仍可联调前端）
uvicorn main:app --reload       # http://127.0.0.1:8000/docs

# 前端（二选一，必须用服务起，不能直接双击 html）
cd frontend
python -m http.server 5500      # 推荐
# 或： npm run serve
```
打开 `http://127.0.0.1:5500`，输入"我的代码报错了"，确认导师**只提问不回答**；切换赛道测试进度不丢。

> ⚠️ 演示模式：未配置 `DEEPSEEK_API_KEY` 时，后端返回固定的苏格拉底式演示回复，但**完整 SSE 流程、阶段推进、历史记忆、代码模拟运行**均正常，方便前端先联调。正式评分需填入真实 Key。

## 协作
共享 GitHub 仓库（由成员 B 建 socratic-guide 并邀请 A、C），采用小步提交 + Pull Request 评审合并的工作流；前后端严格按 `协作文档/04_接口与约定.md` 的字段与事件流对接。团队分工与 AI 协作说明见 `协作文档/`。

# 项目规则（AI 必读）

> 本文件供 Cursor / CodeBuddy / Trae / Cline 等 AI 编程助手自动加载。
> 任何代码生成、修改都必须遵守以下约定，违反即视为错误。

## 项目一句话
AI 苏格拉底式多赛道导师：基于大模型的 Web 应用，"只提问不回答"，覆盖编程排错 / 论文写作 / 自律习惯三赛道，进度独立保存、切换不丢。

## 技术栈（锁定，禁止擅自升级/换框架）
- 后端：Python 3.11 + FastAPI + uvicorn
- 大模型：DeepSeek API（openai 兼容，base_url=https://api.deepseek.com/v1，model=deepseek-chat）
- 持久化：Python 标准库 `sqlite3` 单文件 `state.db`（**不装 Redis**，轻量备选=内存字典+dump json）
- 前端：**原生 HTML + TailwindCSS + 原生 JS（ES Module）**，**禁止引入 React/Vue/TS**
- 前端状态：全局 `store` 对象（发布订阅），零框架
- 本地起服：后端 `uvicorn`；前端优先 `python -m http.server 3000`（少装 Node）
- 部署：国内可达平台（前端腾讯云 EdgeOne Pages / 阿里云 OSS+CDN；后端阿里云函数计算 FC 或轻量服务器 ECS）。**严禁 Vercel / Railway**。

## 接口与约定（前后端对接宪法，必须严格遵守）

### POST /chat（主对话接口）
请求体 JSON：
```json
{ "message": "用户消息", "history": [], "track": "programming", "user_id": "uuid" }
```
- `message`(string,必填) `track`(string,必填,枚举 programming/thesis/habit) `user_id`(string,必填)
- `history` **可选**：后端一律以数据库为准，前端可不传

### 响应：SSE 事件流（Content-Type: text/event-stream，格式 `data: <JSON>\n\n`）
事件 type 及字段：
- `token`: `{content:string}` 流式字，前端追加到当前 AI 气泡
- `stage`: `{stage:number, label:string}` 阶段推进，前端点亮进度条节点
- `tool`: `{name:string, stdout:string, stderr:string}` 工具结果（如 Judge0），前端在代码区展示
- `done`: 本轮结束
- `error`: `{message:string}` 出错

### ⚠️ 前端读流铁律
**必须用 `fetch` + `response.body.getReader()` 手动读流，严禁使用 `EventSource`**（EventSource 仅支持 GET，本项目 /chat 是 POST，用 EventSource 联调必崩）。

### GET /session（取回历史，新增）
- 请求：`GET /session?user_id=xxx&track=programming`
- 响应：`{ "stage": 2, "history": [{"role":"user"/"assistant","content":"..."}] }`
- 前端在**页面加载**和**切换赛道**时调用，历史以后端数据库为准，前端不在自己侧维护权威历史。

### 错误码
- 400 参数缺失/非法（track 不在枚举）→ "请求格式错误"
- 429 调用超限 → "稍后再试"（可选读 `retry_after`）
- 500 后端异常 → "服务异常"，可重试

## 其他硬性约束
- API Key 从环境变量读取（DEEPSEEK_API_KEY），**绝不硬编码、绝不写进代码、绝不提交 Git**（已 gitignore）。
- 三赛道独立：每个 `user_id + track` 有独立 history 与 stage，切换互不干扰；阶段由后端判断，经 `stage` 事件通知前端。
- 苏格拉底式约束：AI **只提问不回答**，用户求答案时回"我不能直接给你答案，但我可以给你一个提示"。
- Judge0：后端用正则检测 ``` 代码块自动触发运行，结果走 `tool` 事件（stdout/stderr）。**先测国内能否调通，不通则降级为模拟运行结果**。
- RAG（轻量）：本地 `knowledge.json` + 关键词匹配，不用向量库/embedding。
- 提交：小步 commit + push + 发 PR 给 B 合并；禁止最后一次性 push。commit 规范 `feat:/fix:/docs:/refactor:`。

## 不要做的事
- 不要引入 React/Vue/TypeScript/Redux 等框架
- 不要用 EventSource 读 /chat 流
- 不要在前端自己维护权威对话历史（只读 GET /session）
- 不要把 Key 写进代码或提交
- 不要擅自改接口字段——要改先改《接口与约定.md》并三人确认

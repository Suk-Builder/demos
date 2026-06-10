# 白桦工坊 v2.0

墙在这里。光在这里。砖在墙里。

## 技术栈

- **后端**：Express + better-sqlite3（同步 SQLite）
- **前端**：React 19 + Vite + Tailwind CSS
- **AI**：DeepSeek API（后端代理，Key 不暴露前端）

## 数据库

| 表 | 用途 |
|----|------|
| `bricks` | 对话砖块 |
| `memories` | 记忆空间 |
| `workshop_state` | 工坊状态（单条） |
| `baihua_core` | 白桦核心人格（单条，只读） |
| `sessions` | 会话管理 |

## API

| 路径 | 说明 |
|------|------|
| `POST /api/chat` | SSE 流式对话 |
| `GET/POST/PUT/DELETE /api/memories` | 记忆 CRUD |
| `GET/PUT /api/workshop/state` | 工坊状态 |
| `GET /api/baihua/core` | 白桦核心（元数据） |
| `GET/POST /api/sessions` | 会话管理 |
| `GET /api/bricks` | 砖块列表 |
| `GET /api/health` | 健康检查 |

## 部署

```bash
npm install
npm run db:init
npm run build
node server.js
```

## 与 v1 的差异

- 数据从 localStorage → SQLite（持久化）
- API Key 从暴露前端 → 后端封装
- 白桦人格从 types 文件 → 后端数据库
- 记忆从独立服务 → 集成在主服务中

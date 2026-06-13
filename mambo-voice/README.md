# 曼波语音助手 (Mambo Voice Assistant)

> 一个可爱的AI语音对话助手，支持语音识别、自然语言对话和语音合成，拥有独特的情绪系统和多性格模式。

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18-339933?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)

![Mambo Voice Assistant](https://mambo.sukaczev.top/banner.png)

## 目录

- [项目介绍](#项目介绍)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [部署指南](#部署指南)
  - [Docker一键部署](#docker一键部署)
  - [手动部署](#手动部署)
  - [SSL证书配置](#ssl证书配置)
- [API文档](#api文档)
- [开发指南](#开发指南)
- [环境变量](#环境变量)
- [CI/CD配置](#cicd配置)
- [常见问题](#常见问题)
- [更新日志](#更新日志)
- [贡献指南](#贡献指南)

---

## 项目介绍

曼波语音助手是一个基于AI的智能语音对话系统，集成了以下核心功能：

- **语音识别 (STT)** — 通过麦克风实时识别用户语音，支持中文
- **AI智能对话** — 基于DeepSeek大语言模型，支持上下文理解和情感回应
- **语音合成 (TTS)** — 将AI回复转换为自然语音播报
- **情绪系统** — 曼波拥有自己的情绪状态，会根据对话内容变化
- **多性格模式** — 支持曼波/白话/戏精等多种对话风格
- **亲密度系统** — 长期对话会提升亲密度，解锁更个性化的互动
- **对话历史** — 本地持久化存储，支持历史回顾

**在线演示**: [https://mambo.sukaczev.top](https://mambo.sukaczev.top)

---

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI框架 |
| TypeScript | 5.0+ | 类型安全 |
| Vite | 5 | 构建工具 |
| Tailwind CSS | 3 | 样式框架 |
| Web Speech API | - | 语音合成与识别 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 18 LTS | 运行环境 |
| Express | 4 | Web框架 |
| DeepSeek API | - | AI对话引擎 |
| PostgreSQL | 15 | 主数据库 |
| Redis | 7 | 缓存层 |
| pgvector | 0.5 | 向量扩展 |

### 运维

| 技术 | 用途 |
|------|------|
| Docker + Compose | 容器化部署 |
| Nginx | 反向代理 + 静态文件 |
| Let's Encrypt | SSL证书 |
| GitHub Actions | CI/CD自动化 |

---

## 快速开始

### 前提条件

- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) 2.0+
- 一个DeepSeek API密钥 ([获取](https://platform.deepseek.com/))

### 一键启动

```bash
# 1. 克隆项目
git clone https://github.com/sukaczev/mambo-voice-assistant.git
cd mambo-voice-assistant

# 2. 配置环境变量
cp .env.production.example .env.production
# 编辑 .env.production，填入你的DeepSeek API密钥和其他配置

# 3. 启动所有服务
docker compose up -d

# 4. 查看状态
docker compose ps
docker compose logs -f

# 5. 访问 http://localhost:8080
```

### 本地开发

```bash
# 启动数据库和缓存
docker compose up -d db redis

# 后端开发
cd backend
npm install
cp .env.example .env
# 编辑.env配置数据库连接
npm run dev

# 前端开发（新终端）
cd frontend
npm install
npm run dev

# 访问 http://localhost:5173
```

---

## 项目结构

```
mambo-voice/
├── frontend/                  # React前端应用
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts        # API客户端封装
│   │   ├── components/          # UI组件
│   │   │   ├── VoiceButton.tsx  # 语音按钮（核心交互）
│   │   │   ├── ChatBubble.tsx   # 聊天消息气泡
│   │   │   ├── ChatWindow.tsx   # 聊天窗口
│   │   │   ├── MoodIndicator.tsx # 情绪指示器
│   │   │   └── PersonalitySelector.tsx # 性格选择器
│   │   ├── hooks/
│   │   │   ├── useChat.ts       # 对话核心Hook
│   │   │   ├── useSpeechRecognition.ts # 语音识别Hook
│   │   │   └── useTextToSpeech.ts     # 语音合成Hook
│   │   ├── utils/
│   │   │   ├── emotionFSM.ts    # 情绪状态机
│   │   │   ├── tickler.ts       # 趣味互动引擎
│   │   │   └── personalityEngine.ts # 性格引擎
│   │   ├── memory/              # 记忆系统
│   │   │   ├── store.ts         # 记忆存储
│   │   │   ├── retrieve.ts      # 记忆检索
│   │   │   ├── summarize.ts     # 记忆总结
│   │   │   └── intimacy.ts      # 亲密度管理
│   │   ├── prompts/             # AI提示词
│   │   │   ├── mambo_base.ts    # 曼波基础性格
│   │   │   ├── baihua_base.ts   # 白话风格
│   │   │   └── drama_base.ts    # 戏精风格
│   │   ├── App.tsx              # 根组件
│   │   └── main.tsx             # 入口文件
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                   # Express后端服务
│   ├── server.js                # 服务入口
│   ├── routes/
│   │   ├── chat.js              # 对话路由
│   │   ├── tts.js               # 语音合成路由
│   │   ├── stt.js               # 语音识别路由
│   │   └── mood.js              # 情绪路由
│   ├── services/
│   │   ├── deepseek.js          # DeepSeek API封装
│   │   ├── emotionService.js    # 情绪服务
│   │   └── memoryService.js     # 记忆服务
│   ├── config/
│   │   └── deepseek.js          # AI配置
│   ├── middleware/
│   │   ├── errorHandler.js      # 错误处理
│   │   ├── auth.js              # 认证中间件
│   │   └── rateLimiter.js       # 限流中间件
│   └── package.json
│
├── database/                  # 数据库文件
│   ├── schema.sql               # 数据库Schema
│   └── init.sql                 # 初始化数据
│
├── scripts/                   # 部署脚本
│   └── deploy.sh                # 生产部署脚本
│
├── .github/workflows/         # CI/CD工作流
│   └── deploy.yml               # 自动部署配置
│
├── Dockerfile                 # 前端Docker构建
├── Dockerfile.backend         # 后端Docker构建
├── docker-compose.yml         # 服务编排
├── nginx.conf                 # Nginx配置
├── .env.production            # 生产环境变量
└── README.md                  # 本文档
```

---

## 部署指南

### Docker一键部署

#### 首次部署

```bash
# 1. 进入项目目录
cd /opt/mambo-voice

# 2. 配置环境变量
vim .env.production
# 必填项:
#   - DEEPSEEK_API_KEY: DeepSeek API密钥
#   - JWT_SECRET: JWT签名密钥（随机长字符串）
#   - POSTGRES_PASSWORD: 数据库root密码
#   - DB_PASSWORD: 应用数据库密码

# 3. 一键部署
bash scripts/deploy.sh

# 或使用docker compose直接启动
docker compose up -d --build
```

#### 更新部署

```bash
# 拉取最新代码后重新部署
git pull origin main
bash scripts/deploy.sh $(git rev-parse --short HEAD)
```

#### 常用运维命令

```bash
# 查看所有服务状态
docker compose ps

# 查看日志
docker compose logs -f              # 所有服务
docker compose logs -f backend      # 仅后端
docker compose logs -f frontend     # 仅前端
docker compose logs -f db           # 仅数据库

# 重启服务
docker compose restart backend

# 进入容器调试
docker exec -it mambo-backend sh
docker exec -it mambo-db psql -U mambo -d mambo_db

# 数据库备份
docker exec mambo-db pg_dump -U mambo mambo_db > backup_$(date +%Y%m%d).sql

# 数据库恢复
cat backup_20240101.sql | docker exec -i mambo-db psql -U mambo -d mambo_db

# 清理未使用的镜像
docker image prune -f

# 查看资源使用
docker stats --no-stream
```

### 手动部署

如需不使用Docker进行部署，请参照以下步骤：

**服务器要求：** Ubuntu 22.04 LTS, 2核CPU, 4GB内存, 20GB磁盘

```bash
# 1. 安装依赖
sudo apt update
sudo apt install -y nodejs npm nginx postgresql redis-server

# 2. 配置PostgreSQL
sudo -u postgres psql -c "CREATE USER mambo WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE mambo_db OWNER mambo;"
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -U mambo -d mambo_db -f database/schema.sql

# 3. 配置Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 4. 部署后端
cd backend
npm install --production
cp .env.example .env
# 编辑.env
nohup node server.js > /var/log/mambo-backend.log 2>&1 &

# 5. 构建并部署前端
cd ../frontend
npm install
npm run build
sudo cp -r dist/* /var/www/mambo/

# 6. 配置Nginx
sudo cp nginx.conf /etc/nginx/sites-available/mambo
sudo ln -sf /etc/nginx/sites-available/mambo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### SSL证书配置

使用Let's Encrypt免费证书（推荐）：

```bash
# 1. 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. 申请证书
sudo certbot --nginx -d mambo.sukaczev.top

# 3. 证书会自动续期，手动测试续期：
sudo certbot renew --dry-run

# 4. 查看证书状态
sudo certbot certificates
```

---

## API文档

### 基础信息

| 项目 | 值 |
|------|------|
| 基础URL | `https://mambo.sukaczev.top/api` |
| 协议 | HTTPS |
| 数据格式 | JSON |
| 认证方式 | Bearer Token (可选) |

### 接口列表

#### 1. 发送消息

```
POST /api/chat
Content-Type: application/json

请求体:
{
  "text": "你好曼波",
  "personality": "mambo"  // 可选: mambo/baihua/drama
}

响应:
{
  "message": {
    "id": "msg_xxx",
    "content": "你好呀！很高兴见到你~",
    "role": "assistant",
    "timestamp": "2024-01-15T10:30:00Z",
    "emotion": "happy"
  },
  "mood": {
    "current": "happy",
    "intensity": 0.8,
    "intimacy": 15,
    "description": "见到你很开心！",
    "animation": "bounce"
  }
}
```

#### 2. 流式对话

```
POST /api/chat/stream
Content-Type: application/json
Accept: text/event-stream

请求体:
{
  "text": "你好",
  "personality": "mambo"
}

响应 (SSE):
data: {"content": "你"}
data: {"content": "好"}
data: {"content": "呀"}
data: {"content": "！"}
data: [DONE]
```

#### 3. 获取对话历史

```
GET /api/chat/history

响应:
{
  "messages": [
    {"id": "1", "content": "你好", "role": "user", "timestamp": "..."},
    {"id": "2", "content": "你好呀！", "role": "assistant", "timestamp": "..."}
  ],
  "hasMore": false
}
```

#### 4. 清空历史

```
DELETE /api/chat/history

响应:
{"success": true}
```

#### 5. 获取情绪状态

```
GET /api/mood

响应:
{
  "current": "happy",
  "intensity": 0.8,
  "intimacy": 23,
  "description": "今天心情不错！",
  "animation": "happy_dance"
}
```

#### 6. 语音合成 (TTS)

```
POST /api/tts
Content-Type: application/json
Accept: audio/mpeg

请求体:
{"text": "你好，我是曼波"}

响应: 音频数据 (MP3格式)
```

#### 7. 语音识别 (STT)

```
POST /api/stt
Content-Type: multipart/form-data

表单字段:
  audio: [音频文件 Blob]

响应:
{
  "text": "你好曼波",
  "confidence": 0.95
}
```

#### 8. 健康检查

```
GET /api/health

响应:
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600
}
```

### 错误响应

```json
{
  "code": "HTTP_401",
  "message": "无效的认证令牌",
  "status": 401
}
```

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 400 | 请求参数错误 | 检查请求体格式 |
| 401 | 未授权 | Token无效或过期 |
| 429 | 请求过多 | 触发限流，请稍后再试 |
| 500 | 服务器内部错误 | 联系管理员 |
| 503 | 服务不可用 | AI服务暂时不可用 |

---

## 开发指南

### 开发环境搭建

```bash
# 克隆项目
git clone https://github.com/sukaczev/mambo-voice-assistant.git
cd mambo-voice-assistant

# 使用Docker启动依赖服务
docker compose up -d db redis

# 安装后端依赖
cd backend && npm install && cd ..

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 开发工作流

```bash
# 终端1：启动后端（带热重载）
cd backend
npm run dev

# 终端2：启动前端（带热重载）
cd frontend
npm run dev

# 终端3：运行测试
npm test

# 终端4：代码检查
npm run lint
npm run type-check
```

### 提交代码

```bash
# 创建新分支
git checkout -b feature/awesome-feature

# 提交更改
git add .
git commit -m "feat: 添加xxx功能"

# 推送到远程
git push origin feature/awesome-feature

# 创建Pull Request到main分支
```

---

## 环境变量

### 生产环境变量 (.env.production)

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `DEEPSEEK_API_KEY` | ✅ | - | DeepSeek API密钥 |
| `JWT_SECRET` | ✅ | - | JWT签名密钥（≥32字符） |
| `POSTGRES_PASSWORD` | ✅ | - | PostgreSQL root密码 |
| `DB_PASSWORD` | ✅ | - | 应用数据库密码 |
| `DATABASE_URL` | ❌ | 自动构建 | 完整数据库连接URL |
| `REDIS_URL` | ❌ | `redis://redis:6379` | Redis连接URL |
| `NODE_ENV` | ❌ | `production` | 运行环境 |
| `PORT` | ❌ | `3001` | 后端端口 |
| `CORS_ORIGIN` | ❌ | `https://mambo.sukaczev.top` | 允许的前端来源 |
| `TTS_ENABLED` | ❌ | `true` | 启用语音合成 |
| `STT_ENABLED` | ❌ | `true` | 启用语音识别 |
| `LOG_LEVEL` | ❌ | `info` | 日志级别 |

### GitHub Actions Secrets

| Secret | 说明 |
|--------|------|
| `DOCKERHUB_USERNAME` | Docker Hub用户名 |
| `DOCKERHUB_TOKEN` | Docker Hub访问令牌 |
| `DEPLOY_HOST` | 部署服务器地址 |
| `DEPLOY_USER` | SSH用户名 |
| `DEPLOY_KEY` | SSH私钥 |
| `DEPLOY_PORT` | SSH端口（默认22） |

---

## CI/CD配置

项目使用GitHub Actions实现自动化部署：

```
Push to main
    │
    ▼
┌──────────────┐
│   代码检测    │  ESLint + TypeScript类型检查
│   (Lint)     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  构建镜像    │  构建前端 + 后端Docker镜像
│  (Build)     │  推送至Docker Hub
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   部署       │  SSH连接服务器
│  (Deploy)    │  执行deploy.sh
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  健康检查    │  验证前端/后端服务
│ (Health)     │
└──────────────┘
```

### 手动触发部署

在GitHub仓库页面：
1. 进入 **Actions** 标签
2. 选择 **曼波语音助手 CI/CD** 工作流
3. 点击 **Run workflow**

---

## 常见问题

### Q: 浏览器不支持语音识别？

请使用 **Chrome** 或 **Edge** 浏览器（版本80+），并确保：
1. 使用HTTPS或localhost访问
2. 已授予麦克风权限
3. 未开启隐私模式（部分浏览器限制）

### Q: 部署后API返回404？

检查Nginx配置中的反向代理路径是否正确：
```nginx
location /api/ {
    proxy_pass http://backend:3001/;
}
```
注意末尾的 `/` 必须一致。

### Q: 数据库连接失败？

检查：
1. 数据库容器是否运行：`docker compose ps`
2. 环境变量是否正确：`.env.production` 中的密码
3. 数据库用户是否存在：`docker exec mambo-db psql -U mambo -c "\du"`

### Q: SSL证书过期？

```bash
# 手动续期
sudo certbot renew

# 检查自动续期是否配置
cat /etc/cron.d/certbot
```

### Q: 如何更换域名？

1. 更新 `.env.production` 中的 `DOMAIN` 和 `CORS_ORIGIN`
2. 更新 `nginx.conf` 中的 `server_name`
3. 更新前端代码中的 `VITE_WS_URL`
4. 申请新域名的SSL证书
5. 重新部署

---

## 更新日志

### v1.0.0 (2024-01-15)
- 初始版本发布
- 支持语音对话、情绪系统、多性格模式
- Docker容器化部署
- GitHub Actions自动CI/CD

---

## 贡献指南

欢迎提交Issue和Pull Request！

### 提交Issue

- 使用中文或英文描述问题
- 提供复现步骤和环境信息
- 附上错误日志（如有）

### 提交代码

1. Fork本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: 添加xxx功能'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

### 代码规范

- 使用ESLint + Prettier保持代码风格一致
- TypeScript类型必须完整，禁用 `any`
- 添加必要的中文注释
- 测试覆盖率不低于80%

---

## 许可证

[MIT](LICENSE) License (c) 2024 sukaczev

---

## 联系方式

- 项目主页: [https://mambo.sukaczev.top](https://mambo.sukaczev.top)
- GitHub: [https://github.com/sukaczev/mambo-voice-assistant](https://github.com/sukaczev/mambo-voice-assistant)
- 问题反馈: [GitHub Issues](https://github.com/sukaczev/mambo-voice-assistant/issues)

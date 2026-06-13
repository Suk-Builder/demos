# ============================================
# 曼波语音助手 — 前端构建 Dockerfile
# 基于 Node.js 18 Alpine + Nginx 多阶段构建
# ============================================

# -------------------------------
# 第一阶段：构建阶段 (Builder)
# -------------------------------
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装构建依赖（用于原生模块编译）
RUN apk add --no-cache python3 make g++

# 优先复制依赖配置文件（利用Docker缓存层）
COPY frontend/package.json frontend/package-lock.json* ./

# 安装生产依赖（精确版本，确保可复现构建）
RUN npm ci --only=production=false

# 复制前端源代码
COPY frontend/ .

# 注入构建时的环境变量（Vite以VITE_前缀接收）
ARG VITE_API_BASE_URL=/api
ARG VITE_APP_NAME=曼波语音助手
ARG VITE_WS_URL=wss://mambo.sukaczev.top/ws
ARG VITE_MAX_HISTORY=50

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_MAX_HISTORY=${VITE_MAX_HISTORY}

# 执行生产构建（输出到dist目录）
RUN npm run build

# -------------------------------
# 第二阶段：生产阶段 (Production)
# -------------------------------
FROM nginx:1.25-alpine

# 维护者标签
LABEL maintainer="sukaczev"
LABEL project="mambo-voice-assistant"
LABEL version="1.0.0"

# 安装必要工具（用于健康检查和调试）
RUN apk add --no-cache curl ca-certificates

# 复制Nginx配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从前一阶段复制构建产物到Nginx服务目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 创建自定义错误页面目录
RUN mkdir -p /usr/share/nginx/html/errors

# 复制错误页面（404、500等）
COPY --from=builder /app/dist/index.html /usr/share/nginx/html/errors/404.html

# 设置文件权限（防止权限问题）
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# 暴露80端口（HTTP）
EXPOSE 80

# 健康检查：每30秒检查一次Nginx是否响应
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# 启动Nginx（前台运行，便于Docker管理进程）
CMD ["nginx", "-g", "daemon off;"]

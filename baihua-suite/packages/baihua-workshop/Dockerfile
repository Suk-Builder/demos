# 白桦工坊 - Docker 构建
# 多阶段构建，前端构建 + 后端运行

# --- 阶段 1：构建前端 ---
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package.json ./
RUN npm install --legacy-peer-deps 2>&1 || npm install

# 复制源码并构建
COPY . .
RUN npm run build

# --- 阶段 2：运行后端 ---
FROM node:20-alpine

WORKDIR /app

# 只安装生产依赖
COPY package.json ./
RUN npm install --production --legacy-peer-deps 2>&1 || npm install --production

# 复制构建产物和后端代码
COPY --from=builder /app/dist ./dist
COPY server.js ./

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3456/api/health || exit 1

EXPOSE 3456

CMD ["node", "server.js"]

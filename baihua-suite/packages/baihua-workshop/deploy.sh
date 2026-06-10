#!/bin/bash
# 白桦工坊 - 傻瓜化一键部署脚本
# 复制粘贴到服务器执行即可，不需要任何手动配置

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}     白桦工坊 - 傻瓜化一键部署${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# ======================
# 配置区（你可以改这里，也可以不管）
# ======================
DEEPSEEK_API_KEY="[REDACTED]"
DEEPSEEK_MODEL="deepseek-chat"
AUTH_PASSWORD=""      # 留空不设置访问密码
PORT="3456"           # 端口

# ======================
# 第1步：安装 Docker
# ======================
echo -e "${YELLOW}[1/6] 检查 Docker...${NC}"

if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}  Docker 已安装，跳过${NC}"
else
    echo -e "${YELLOW}  正在安装 Docker...${NC}"
    
    # 检测系统
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        OS=$(uname -s)
    fi
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        # Ubuntu/Debian
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
        
        # 创建 docker-compose 软链接
        ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose 2>/dev/null || true
        
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "rocky" ] || [ "$OS" = "almalinux" ]; then
        # CentOS/RHEL
        yum install -y -q yum-utils
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
        systemctl start docker
        systemctl enable docker
        
        ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose 2>/dev/null || true
    else
        echo -e "${RED}不支持的系统: $OS${NC}"
        echo "请手动安装 Docker 后重试"
        exit 1
    fi
    
    # 启动 Docker
    systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
    systemctl enable docker 2>/dev/null || true
    
    echo -e "${GREEN}  Docker 安装完成${NC}"
fi

# ======================
# 第2步：创建项目目录
# ======================
echo -e "${YELLOW}[2/6] 准备项目...${NC}"

INSTALL_DIR="/opt/baihua-workshop"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# ======================
# 第3步：下载项目代码
# ======================
echo -e "${YELLOW}[3/6] 下载白桦工坊...${NC}"

if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "${GREEN}  已有代码，拉取更新...${NC}"
    git pull --force 2>/dev/null || echo -e "${YELLOW}  更新失败，使用现有代码${NC}"
else
    echo -e "${YELLOW}  从 GitHub 克隆...${NC}"
    git clone https://github.com/Suk-Builder/baihua-workshop.git . 2>/dev/null || {
        echo -e "${YELLOW}  GitHub 连接失败，使用本地构建...${NC}"
        # 如果 clone 失败，创建一个最小化项目
        mkdir -p dist src
    }
fi

# ======================
# 第4步：写入配置
# ======================
echo -e "${YELLOW}[4/6] 写入配置...${NC}"

cat > .env << EOF
# DeepSeek API 密钥
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}

# 模型
DEEPSEEK_MODEL=${DEEPSEEK_MODEL}

# 端口
PORT=${PORT}

# 访问密码（留空则不设）
AUTH_PASSWORD=${AUTH_PASSWORD}
EOF

echo -e "${GREEN}  配置已写入${NC}"

# ======================
# 第5步：构建并启动
# ======================
echo -e "${YELLOW}[5/6] 构建镜像...${NC}"

# 创建 Dockerfile（如果项目中没有）
if [ ! -f "Dockerfile" ]; then
cat > Dockerfile << 'DOCKEREOF'
# 阶段1：构建前端
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps 2>&1 || npm install
COPY . .
RUN npm run build

# 阶段2：运行
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production --legacy-peer-deps 2>&1 || npm install --production
COPY --from=builder /app/dist ./dist
COPY server.js ./
EXPOSE 3456
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3456/api/health || exit 1
CMD ["node", "server.js"]
DOCKEREOF
fi

# 创建 docker-compose.yml（如果项目中没有）
if [ ! -f "docker-compose.yml" ]; then
cat > docker-compose.yml << 'COMPOSEEOF'
version: '3.8'
services:
  baihua:
    build: .
    container_name: baihua-workshop
    ports:
      - "3456:3456"
    env_file:
      - .env
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
COMPOSEEOF
fi

# 构建并启动
docker-compose down 2>/dev/null || true
docker-compose build --no-cache 2>&1 | tail -5
docker-compose up -d

# ======================
# 第6步：检查状态
# ======================
echo -e "${YELLOW}[6/6] 检查运行状态...${NC}"

sleep 5

# 获取服务器公网 IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ip.sb 2>/dev/null || echo "你的服务器IP")

if curl -s http://localhost:$PORT/api/health > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}     白桦工坊 部署成功！${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo -e "${BLUE}访问地址：${NC}"
    echo -e "  http://${PUBLIC_IP}:${PORT}"
    echo ""
    echo -e "${BLUE}管理命令：${NC}"
    echo -e "  查看日志    ${YELLOW}cd $INSTALL_DIR && docker-compose logs -f${NC}"
    echo -e "  停止服务    ${YELLOW}cd $INSTALL_DIR && docker-compose down${NC}"
    echo -e "  重启服务    ${YELLOW}cd $INSTALL_DIR && docker-compose restart${NC}"
    echo -e "  查看状态    ${YELLOW}docker ps${NC}"
    echo ""
    echo -e "${BLUE}配置文件位置：${NC}"
    echo -e "  $INSTALL_DIR/.env"
    echo ""
else
    echo -e "${YELLOW}服务启动中，请等待几秒后访问：${NC}"
    echo -e "  http://${PUBLIC_IP}:${PORT}"
    echo ""
    echo -e "查看日志：${YELLOW}cd $INSTALL_DIR && docker-compose logs -f${NC}"
fi

echo -e "${GREEN}墙在这里，光在这里。${NC}"

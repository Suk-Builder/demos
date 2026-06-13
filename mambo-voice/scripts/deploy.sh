#!/bin/bash
# ============================================
# 曼波语音助手 — 生产环境部署脚本
# 用法: bash deploy.sh [镜像标签(默认latest)]
# 示例: bash deploy.sh abc1234
# ============================================

set -euo pipefail

# ---- 脚本配置 ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="mambo-voice"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
ENV_FILE="$PROJECT_DIR/.env.production"

# 镜像标签（默认latest）
IMAGE_TAG="${1:-latest}"
DOCKERHUB_USER="${DOCKERHUB_USERNAME:-sukaczev}"

# 颜色定义（美化输出）
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # 重置颜色

# ---- 日志函数 ----
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

# ---- 健康检查函数 ----
# 检查容器健康状态，超时120秒
wait_for_container() {
    local container_name="$1"
    local max_attempts=24
    local attempt=1

    log_info "等待容器 $container_name 就绪..."
    while [ $attempt -le $max_attempts ]; do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unhealthy")

        if [ "$status" == "healthy" ]; then
            log_success "容器 $container_name 已就绪（尝试 $attempt 次）"
            return 0
        elif [ "$status" == "unhealthy" ]; then
            log_error "容器 $container_name 健康检查失败"
            return 1
        fi

        log_info "等待中... ($attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done

    log_error "容器 $container_name 启动超时"
    return 1
}

# 检查服务HTTP端点
health_check_http() {
    local url="$1"
    local service_name="$2"
    local max_attempts=12
    local attempt=1

    log_info "HTTP健康检查: $service_name ($url)"
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            log_success "$service_name HTTP服务正常"
            return 0
        fi
        log_info "HTTP检查中... ($attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done

    log_error "$service_name HTTP服务未响应"
    return 1
}

# ---- 数据库迁移函数 ----
run_migrations() {
    log_step "执行数据库迁移"

    local db_container="mambo-db"
    local backend_container="mambo-backend"

    # 等待数据库就绪
    log_info "检查数据库连接..."
    local attempt=1
    local max_attempts=10
    while [ $attempt -le $max_attempts ]; do
        if docker exec "$db_container" pg_isready -U mambo > /dev/null 2>&1; then
            log_success "数据库已就绪"
            break
        fi
        log_info "等待数据库就绪... ($attempt/$max_attempts)"
        sleep 3
        attempt=$((attempt + 1))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "数据库连接超时"
        return 1
    fi

    # 检查后端是否有迁移脚本
    if docker exec "$backend_container" test -f /app/migrate.js 2>/dev/null; then
        log_info "执行后端数据库迁移..."
        docker exec "$backend_container" node /app/migrate.js || log_warn "迁移脚本执行失败"
    else
        log_info "未找到迁移脚本，跳过（依赖init.sql初始化）"
    fi

    # 可选：执行额外的Schema更新
    if [ -f "$PROJECT_DIR/database/migrations.sql" ]; then
        log_info "执行额外迁移脚本..."
        docker cp "$PROJECT_DIR/database/migrations.sql" "$db_container":/tmp/
        docker exec "$db_container" psql -U mambo -d mambo_db -f /tmp/migrations.sql || log_warn "额外迁移失败"
    fi

    log_success "数据库迁移完成"
}

# ---- 主部署流程 ----
main() {
    log_step "🚀 曼波语音助手部署开始"
    log_info "部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "镜像标签: $IMAGE_TAG"
    log_info "项目目录: $PROJECT_DIR"

    # ---- 步骤1：环境检查 ----
    log_step "步骤 1/8：环境检查"

    # 检查Docker是否安装
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    log_success "Docker已安装: $(docker --version)"

    # 检查Docker Compose是否可用
    if ! docker compose version &> /dev/null && ! docker-compose --version &> /dev/null; then
        log_error "Docker Compose未安装"
        exit 1
    fi
    log_success "Docker Compose可用"

    # 检查环境文件
    if [ ! -f "$ENV_FILE" ]; then
        log_error "环境文件不存在: $ENV_FILE"
        log_info "请复制 .env.example 到 .env.production 并填写配置"
        exit 1
    fi
    log_success "环境文件存在: $ENV_FILE"

    # 检查Docker Hub登录状态
    if ! docker info 2>/dev/null | grep -q "Username"; then
        log_warn "未登录Docker Hub，尝试自动登录..."
        if [ -n "${DOCKERHUB_TOKEN:-}" ]; then
            echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USER" --password-stdin 2>/dev/null || \
                log_warn "Docker Hub自动登录失败，将使用本地镜像"
        fi
    fi

    # ---- 步骤2：备份数据 ----
    log_step "步骤 2/8：数据备份"
    BACKUP_DIR="/opt/backups/mambo-voice/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # 备份数据库（如果容器正在运行）
    if docker ps -q -f name=mambo-db | grep -q .; then
        log_info "备份PostgreSQL数据库..."
        docker exec mambo-db pg_dump -U mambo -d mambo_db > "$BACKUP_DIR/db_backup.sql" 2>/dev/null && \
            log_success "数据库备份完成: $BACKUP_DIR/db_backup.sql" || \
            log_warn "数据库备份失败（可能无数据）"
    else
        log_info "数据库未运行，跳过备份"
    fi

    # ---- 步骤3：拉取最新镜像 ----
    log_step "步骤 3/8：拉取最新镜像"
    if [ "$IMAGE_TAG" != "latest" ]; then
        log_info "拉取前端镜像: $DOCKERHUB_USER/mambo-voice-frontend:$IMAGE_TAG"
        docker pull "$DOCKERHUB_USER/mambo-voice-frontend:$IMAGE_TAG" 2>/dev/null || \
            log_warn "前端镜像拉取失败，将使用本地构建"

        log_info "拉取后端镜像: $DOCKERHUB_USER/mambo-voice-backend:$IMAGE_TAG"
        docker pull "$DOCKERHUB_USER/mambo-voice-backend:$IMAGE_TAG" 2>/dev/null || \
            log_warn "后端镜像拉取失败，将使用本地构建"
    fi

    # ---- 步骤4：停止旧容器 ----
    log_step "步骤 4/8：停止旧容器"
    cd "$PROJECT_DIR"

    # 优雅停止（给30秒处理中的请求）
    log_info "优雅停止现有容器..."
    docker compose down --timeout 30 2>/dev/null || docker-compose down --timeout 30 2>/dev/null || \
        log_warn "停止容器时出现问题（可能无运行中的容器）"

    # 清理悬空镜像（释放磁盘空间）
    log_info "清理悬空镜像..."
    docker image prune -f > /dev/null 2>&1 || true

    log_success "旧容器已停止"

    # ---- 步骤5：构建并启动新容器 ----
    log_step "步骤 5/8：构建并启动新容器"

    # 使用docker-compose启动所有服务
    if [ -f "docker-compose.yml" ]; then
        if [ "$IMAGE_TAG" != "latest" ]; then
            # 使用特定标签的镜像
            export FRONTEND_IMAGE="$DOCKERHUB_USER/mambo-voice-frontend:$IMAGE_TAG"
            export BACKEND_IMAGE="$DOCKERHUB_USER/mambo-voice-backend:$IMAGE_TAG"
            docker compose up -d --build
        else
            # 使用latest标签或本地构建
            docker compose up -d --build
        fi
    else
        log_error "docker-compose.yml 不存在"
        exit 1
    fi

    log_success "新容器已启动"

    # ---- 步骤6：等待服务就绪 ----
    log_step "步骤 6/8：等待服务就绪"

    # 等待数据库就绪
    wait_for_container "mambo-db" || exit 1

    # 等待后端就绪
    wait_for_container "mambo-backend" || exit 1

    # 等待前端就绪
    wait_for_container "mambo-frontend" || exit 1

    # 等待Redis就绪
    if docker ps -q -f name=mambo-redis | grep -q .; then
        log_info "等待Redis就绪..."
        sleep 3
        if docker exec mambo-redis redis-cli ping | grep -q "PONG"; then
            log_success "Redis服务正常"
        else
            log_warn "Redis响应异常"
        fi
    fi

    log_success "所有服务已就绪"

    # ---- 步骤7：数据库迁移 ----
    log_step "步骤 7/8：数据库迁移"
    run_migrations

    # ---- 步骤8：健康检查 ----
    log_step "步骤 8/8：健康检查"

    # 检查前端服务（通过本地Nginx）
    sleep 5
    health_check_http "http://localhost:8080/health" "前端服务" || exit 1

    # 检查后端API
    health_check_http "http://localhost:3001/health" "后端API" || exit 1

    # 检查反向代理（如果外部Nginx已配置）
    if command -v nginx &> /dev/null; then
        log_info "检查Nginx配置..."
        nginx -t 2>/dev/null && \
            systemctl reload nginx 2>/dev/null && \
            log_success "Nginx配置已重载" || \
            log_warn "Nginx重载失败（可能未使用系统Nginx）"
    fi

    # 显示部署后状态
    log_step "📊 部署状态"
    echo ""
    docker compose ps 2>/dev/null || docker-compose ps
    echo ""

    # 显示资源使用
    log_info "容器资源使用:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.Status}}" \
        mambo-frontend mambo-backend mambo-db mambo-redis 2>/dev/null || true

    # ---- 部署完成 ----
    log_step "🎉 部署完成"
    log_success "网站地址: https://mambo.sukaczev.top"
    log_success "API地址:  https://mambo.sukaczev.top/api"
    log_info "部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "查看日志: docker compose logs -f"
    log_info "备份位置: $BACKUP_DIR"
}

# ---- 信号处理（优雅退出） ----
cleanup() {
    log_warn "部署脚本被中断"
    exit 130
}
trap cleanup SIGINT SIGTERM

# ---- 执行主函数 ----
main "$@"

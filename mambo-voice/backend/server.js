/**
 * 曼波语音助手 - 主服务入口文件
 * Express 服务器配置、中间件注册、路由挂载和启动
 */

// 加载环境变量（必须在其他模块之前加载）
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 导入路由模块
const chatRouter = require('./routes/chat');

// 导入错误处理中间件
const {
  globalErrorHandler,
  setupUnhandledRejectionHandler,
  setupUncaughtExceptionHandler,
} = require('./middleware/errorHandler');

// ============================================
// 创建 Express 应用实例
// ============================================
const app = express();

// 从环境变量读取服务端口，默认 3001
const PORT = process.env.PORT || 3001;

// ============================================
// 全局中间件配置
// ============================================

/**
 * CORS 跨域配置
 * 允许指定来源访问 API，开发环境可放宽限制
 */
const corsOptions = {
  // 允许的来源，生产环境建议设置为具体的域名
  origin: '*',
  // 允许的 HTTP 方法
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // 允许的头信息
  allowedHeaders: ['Content-Type', 'Authorization'],
  // 是否允许携带凭证（cookies）
  credentials: false,
  // 预检请求缓存时间（秒）
  maxAge: 86400,
};

// 注册 CORS 中间件
app.use(cors(corsOptions));

/**
 * 请求体解析中间件
 * 解析 JSON 格式的请求体
 */
app.use(express.json());

/**
 * URL 编码请求体解析
 * 解析 application/x-www-form-urlencoded 格式的请求体
 */
app.use(express.urlencoded({ extended: true }));

/**
 * 请求日志中间件
 * 记录每个请求的详细信息，便于调试和监控
 */
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// ============================================
// 限流配置（防止 API 被滥用）
// ============================================

/**
 * 全局限流配置
 * 每个 IP 在 15 分钟内最多允许 100 次请求
 */
const globalLimiter = rateLimit({
  // 时间窗口（毫秒），15 分钟
  windowMs: 15 * 60 * 1000,
  // 在时间窗口内允许的最大请求数
  max: 100,
  // 是否把限流信息加到响应头
  standardHeaders: true,
  // 是否启用旧版 X-RateLimit 头
  legacyHeaders: false,
  // 超出限制时的处理函数
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试',
      errorCode: 'TOO_MANY_REQUESTS',
      status: 429,
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * 聊天接口专用限流配置（更严格）
 * 每个 IP 在 1 分钟内最多允许 20 次对话请求
 */
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: '对话请求过于频繁，请稍后再试',
      errorCode: 'CHAT_RATE_LIMIT',
      status: 429,
      timestamp: new Date().toISOString(),
    });
  },
});

// 注册全局限流中间件
app.use(globalLimiter);

// ============================================
// 健康检查端点
// ============================================

/**
 * GET /health
 * 服务健康检查接口
 * 用于负载均衡器和监控工具检测服务状态
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'mambo-voice-assistant',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// API 路由挂载
// ============================================

/**
 * 对话相关路由
 * /api/chat        - POST 发送对话
 * /api/chat/personalities - GET 获取人格列表
 * /api/chat/moods  - GET 获取情绪列表
 */
app.use('/api', chatLimiter, chatRouter);

// ============================================
// 根路径响应
// ============================================

/**
 * GET /
 * 服务根路径，返回基本信息
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '欢迎来到曼波语音助手 API 服务！',
    service: 'mambo-voice-assistant',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health - 健康检查',
      chat: 'POST /api/chat - 对话接口',
      personalities: 'GET /api/chat/personalities - 人格列表',
      moods: 'GET /api/chat/moods - 情绪列表',
    },
    documentation: '详见项目 README.md',
  });
});

// ============================================
// 404 处理中间件
// ============================================

/**
 * 处理未匹配到的路由
 * 当请求的路径没有对应的路由处理时，返回 404 错误
 */
app.use((req, res, next) => {
  const error = new Error(`找不到路径：${req.originalUrl}`);
  error.statusCode = 404;
  error.errorCode = 'NOT_FOUND';
  next(error);
});

// ============================================
// 全局错误处理中间件
// ============================================

/**
 * 注册全局错误处理中间件
 * 必须放在所有路由和中间件之后，捕获所有未处理的错误
 */
app.use(globalErrorHandler);

// ============================================
// 未处理异常和拒绝的处理
// ============================================

// 设置未处理的 Promise 拒绝处理器
setupUnhandledRejectionHandler();

// 设置未捕获的异常处理器
setupUncaughtExceptionHandler();

// ============================================
// 启动服务器
// ============================================

/**
 * 启动 Express 服务器
 * 监听指定的端口，等待客户端连接
 */
app.listen(PORT, () => {
  console.log('========================================');
  console.log('  曼波语音助手 API 服务已启动！');
  console.log(`  服务地址：http://localhost:${PORT}`);
  console.log(`  环境模式：${process.env.NODE_ENV || 'development'}`);
  console.log(`  Node 版本：${process.version}`);
  console.log('========================================');
  console.log('  可用端点：');
  console.log(`  - http://localhost:${PORT}/         API 说明`);
  console.log(`  - http://localhost:${PORT}/health   健康检查`);
  console.log(`  - POST http://localhost:${PORT}/api/chat  对话接口`);
  console.log('========================================');
});

// 导出 app 实例（便于测试）
module.exports = app;

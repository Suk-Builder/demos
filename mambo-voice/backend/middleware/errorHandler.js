/**
 * 全局错误处理中间件
 * 统一处理应用中的所有错误，返回标准化的错误响应格式
 */

/**
 * 自定义应用错误类
 * 用于区分预期的业务错误和意外的系统错误
 */
class AppError extends Error {
  /**
   * @param {string} message - 错误描述信息
   * @param {number} statusCode - HTTP 状态码，默认 500
   * @param {string} errorCode - 错误业务代码，用于前端识别错误类型
   */
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    // 标记为操作型错误（非程序 bug）
    this.isOperational = true;

    // 捕获堆栈跟踪（排除构造函数本身）
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 全局错误处理中间件（Express 四参数格式）
 * 必须在所有路由之后注册
 * @param {Error} err - 错误对象
 * @param {object} req - Express 请求对象
 * @param {object} res - Express 响应对象
 * @param {function} next - Express 下一个中间件函数
 */
function globalErrorHandler(err, req, res, next) {
  // 获取当前时间戳
  const timestamp = new Date().toISOString();

  // 默认错误状态码和信息
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let message = err.message || '服务器内部错误';

  // 处理 fetch 请求超时错误（AbortError）
  if (err.name === 'AbortError') {
    statusCode = 504;
    errorCode = 'REQUEST_TIMEOUT';
    message = '请求 DeepSeek API 超时，请稍后重试';
  }

  // 处理 JSON 解析错误
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = '请求体 JSON 格式不正确';
  }

  // 构建标准错误响应对象
  const errorResponse = {
    // 是否请求成功
    success: false,
    // 错误描述信息
    message: message,
    // 业务错误代码
    errorCode: errorCode,
    // HTTP 状态码
    status: statusCode,
    // 时间戳
    timestamp: timestamp,
    // 请求路径（便于调试）
    path: req.originalUrl || req.url,
    // 请求方法
    method: req.method,
  };

  // 开发环境下添加堆栈信息（生产环境不暴露）
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }

  // 打印错误日志到控制台
  console.error('========================================');
  console.error(`[错误] ${timestamp}`);
  console.error(`[路径] ${req.method} ${req.originalUrl}`);
  console.error(`[状态] ${statusCode} (${errorCode})`);
  console.error(`[信息] ${message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[堆栈] ${err.stack}`);
  }
  console.error('========================================');

  // 发送错误响应
  res.status(statusCode).json(errorResponse);
}

/**
 * 处理未捕获的 Promise 拒绝
 * 防止 Node.js 进程因未处理的 Promise 错误而崩溃
 */
function setupUnhandledRejectionHandler() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[未处理的 Promise 拒绝]', reason);
    // 记录未处理的 Promise，但不终止进程
    // 实际生产环境可以使用日志服务记录
  });
}

/**
 * 处理未捕获的异常
 * 防止 Node.js 进程因未捕获的同步错误而崩溃
 */
function setupUncaughtExceptionHandler() {
  process.on('uncaughtException', (error) => {
    console.error('[未捕获的异常]', error);
    // 对于未捕获的异常，优雅地关闭进程
    // 实际生产环境可以在这里发送告警通知
    process.exit(1);
  });
}

// 导出模块
module.exports = {
  AppError,
  globalErrorHandler,
  setupUnhandledRejectionHandler,
  setupUncaughtExceptionHandler,
};

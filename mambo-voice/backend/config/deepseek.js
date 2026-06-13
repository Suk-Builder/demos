/**
 * DeepSeek API 配置模块
 * 负责管理 DeepSeek API 的连接配置、请求发送、超时处理和重试机制
 */

// 加载环境变量
require('dotenv').config();

/**
 * DeepSeek 配置对象
 * 从环境变量读取配置，提供默认值
 */
const deepseekConfig = {
  // API 密钥，必须从环境变量设置
  apiKey: process.env.DEEPSEEK_API_KEY,
  // API 请求地址，默认使用 DeepSeek 官方接口
  apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
  // 请求超时时间（毫秒），默认 30 秒
  timeout: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,
  // 请求失败时的重试次数，默认 3 次
  retryCount: parseInt(process.env.RETRY_COUNT, 10) || 3,
  // 每次重试之间的间隔时间（毫秒），默认 1 秒
  retryDelay: parseInt(process.env.RETRY_DELAY, 10) || 1000,
  // 使用的模型名称
  model: 'deepseek-chat',
  // 默认温度参数，控制回复的创造性（0-2）
  temperature: 0.8,
  // 最大 token 数限制
  maxTokens: 2048,
};

/**
 * 验证 DeepSeek 配置是否完整
 * 如果缺少必要的配置项，抛出错误
 */
function validateConfig() {
  if (!deepseekConfig.apiKey) {
    throw new Error('缺少 DeepSeek API 密钥，请在 .env 文件中设置 DEEPSEEK_API_KEY');
  }
}

/**
 * 延迟函数，用于重试间隔
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带超时控制的 fetch 请求
 * @param {string} url - 请求地址
 * @param {object} options - fetch 选项
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeout) {
  // 创建 AbortController 用于取消超时请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    // 无论成功失败都清除定时器
    clearTimeout(timeoutId);
  }
}

/**
 * 发送聊天请求到 DeepSeek API
 * 包含重试机制和错误处理
 * @param {Array} messages - 消息数组，格式为 [{ role, content }, ...]
 * @param {object} options - 可选参数 { temperature, maxTokens }
 * @returns {Promise<object>} - DeepSeek API 的回复内容
 */
async function chatCompletion(messages, options = {}) {
  // 发送请求前验证配置
  validateConfig();

  // 构建请求体
  const requestBody = {
    model: deepseekConfig.model,
    messages: messages,
    temperature: options.temperature || deepseekConfig.temperature,
    max_tokens: options.maxTokens || deepseekConfig.maxTokens,
  };

  // 构建请求头
  const requestOptions = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deepseekConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  };

  // 重试循环
  let lastError = null;
  for (let attempt = 1; attempt <= deepseekConfig.retryCount; attempt++) {
    try {
      console.log(`[DeepSeek] 第 ${attempt} 次请求...`);

      // 发送带超时的请求
      const response = await fetchWithTimeout(
        deepseekConfig.apiUrl,
        requestOptions,
        deepseekConfig.timeout
      );

      // 检查 HTTP 响应状态
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API 请求失败: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      // 解析响应 JSON
      const data = await response.json();

      // 验证响应数据结构
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('DeepSeek API 返回数据格式异常');
      }

      console.log('[DeepSeek] 请求成功');
      return data.choices[0].message.content;
    } catch (error) {
      lastError = error;
      console.error(`[DeepSeek] 第 ${attempt} 次请求失败:`, error.message);

      // 如果是最后一次尝试，不再重试
      if (attempt === deepseekConfig.retryCount) {
        break;
      }

      // 等待一段时间后重试
      console.log(`[DeepSeek] ${deepseekConfig.retryDelay}ms 后重试...`);
      await delay(deepseekConfig.retryDelay);
    }
  }

  // 所有重试都失败了，抛出最终错误
  throw new Error(
    `DeepSeek API 在 ${deepseekConfig.retryCount} 次尝试后仍然失败: ${lastError.message}`
  );
}

// 导出配置和函数
module.exports = {
  deepseekConfig,
  chatCompletion,
  validateConfig,
};

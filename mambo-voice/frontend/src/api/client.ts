// ============================================
// 曼波语音助手 — API客户端
// 功能：封装HTTP请求、自动处理认证、错误重试、超时控制
// ============================================

// ---- ImportMeta 类型扩展（Vite 环境变量）----
interface ImportMetaEnv {
  /** API 基础地址 */
  VITE_API_BASE_URL?: string;
  // 其他 Vite 前缀环境变量可在此声明
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ---- 类型定义 ----

/** 单条聊天消息 */
export interface Message {
  /** 消息唯一ID */
  id: string;
  /** 消息内容 */
  content: string;
  /** 发送者：user=用户, assistant=曼波, system=系统 */
  role: 'user' | 'assistant' | 'system';
  /** 发送时间 */
  timestamp: string;
  /** 消息关联的情绪状态 */
  emotion?: Emotion;
  /** 消息关联的音频URL（语音回复时） */
  audioUrl?: string;
  /** 是否处于流式接收中 */
  streaming?: boolean;
}

/** 聊天响应 */
export interface ChatResponse {
  /** 响应消息 */
  message: Message;
  /** 当前曼波的情绪状态 */
  mood: EmotionState;
  /** 亲密度变化 */
  intimacyDelta?: number;
  /** 消耗的token数 */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** 曼波的情绪枚举 */
export enum Emotion {
  HAPPY = 'happy',         // 开心
  SAD = 'sad',             // 难过
  ANGRY = 'angry',         // 生气
  EXCITED = 'excited',     // 兴奋
  CALM = 'calm',           // 平静
  CURIOUS = 'curious',     // 好奇
  SHY = 'shy',             // 害羞
  MISCHIEVOUS = 'mischievous', // 调皮
  CONFUSED = 'confused',   // 困惑
  LOVING = 'loving',       // 温柔
}

/** 情绪状态（包含强度和变化趋势） */
export interface EmotionState {
  /** 当前主导情绪 */
  current: Emotion;
  /** 情绪强度 0-1 */
  intensity: number;
  /** 亲密度等级 0-100 */
  intimacy: number;
  /** 情绪描述文本 */
  description: string;
  /** 推荐的前端动画 */
  animation: string;
}

/** API请求配置 */
interface RequestConfig {
  /** 请求超时（毫秒） */
  timeout?: number;
  /** 是否自动重试 */
  retry?: boolean;
  /** 重试次数 */
  retryCount?: number;
  /** 是否需要认证 */
  auth?: boolean;
}

/** API错误响应 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'UNKNOWN_ERROR',
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- 常量配置 ----

/** API基础URL（从环境变量读取，默认相对路径） */
// 自动检测环境：如果在 localhost 开发，指向 localhost:3001
// 如果在生产环境（其他域名），使用相对路径 /api（由Nginx反向代理）
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocalhost ? 'http://localhost:3001/api' : '/api';

/** 默认请求超时（30秒） */
const DEFAULT_TIMEOUT = 30000;

/** 最大重试次数 */
const MAX_RETRIES = 3;

/** 重试延迟基数（毫秒，指数退避） */
const RETRY_BASE_DELAY = 1000;

// ---- 工具函数 ----

/**
 * 延迟函数（用于重试间隔）
 * @param ms 延迟毫秒数
 */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 获取存储的认证Token
 * 优先从localStorage读取JWT token
 */
const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('mambo_auth_token');
  } catch {
    // 私密模式下localStorage不可用
    return null;
  }
};

/**
 * 带超时的fetch封装
 * @param url 请求地址
 * @param options fetch选项
 * @param timeout 超时毫秒
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('请求超时，请检查网络连接', 408, 'TIMEOUT');
    }
    throw error;
  }
};

/**
 * 核心HTTP请求函数
 * 支持：超时控制、自动重试、认证注入、错误处理
 *
 * @param endpoint API端点路径（不含baseURL）
 * @param options fetch选项
 * @param config 额外配置
 */
const request = async <T>(
  endpoint: string,
  options: RequestInit = {},
  config: RequestConfig = {},
): Promise<T> => {
  const {
    timeout = DEFAULT_TIMEOUT,
    retry = true,
    retryCount = MAX_RETRIES,
    auth = true,
  } = config;

  const url = `${API_BASE_URL}${endpoint}`;

  // 构建请求头
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // 注入认证Token
  if (auth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // 设备标识（用于会话追踪）
  const deviceId = localStorage.getItem('mambo_device_id') || generateDeviceId();
  headers['X-Device-ID'] = deviceId;

  let lastError: Error = new ApiError('请求失败', 500);

  // 重试循环
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const response = await fetchWithTimeout(url, { ...options, headers }, timeout);

      // 处理HTTP错误状态
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `请求失败: ${response.statusText}`,
          response.status,
          errorData.code || `HTTP_${response.status}`,
          errorData,
        );
      }

      // 204 No Content 直接返回空对象
      if (response.status === 204) {
        return {} as T;
      }

      // 解析JSON响应
      const data = await response.json();
      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 不重试的情况：客户端错误4xx（除429外）
      if (error instanceof ApiError) {
        if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          throw error; // 直接抛出，不重试
        }
      }

      // 最后一次尝试失败，直接抛出
      if (attempt === retryCount || !retry) {
        throw lastError;
      }

      // 指数退避重试
      const backoffDelay = RETRY_BASE_DELAY * Math.pow(2, attempt);
      console.warn(`[API] 请求失败，${backoffDelay}ms后重试 (${attempt + 1}/${retryCount})`, error);
      await delay(backoffDelay);
    }
  }

  throw lastError;
};

/**
 * 生成设备唯一标识
 */
function generateDeviceId(): string {
  const id = `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('mambo_device_id', id);
  return id;
}

/**
 * 从SSE响应对象中提取文本内容
 * 适配多种后端API响应格式（OpenAI兼容、自定义格式等）
 * @param obj SSE事件解析后的JSON对象
 * @returns 提取到的文本内容，未找到时返回空字符串
 */
function extractContentFromSSE(obj: unknown): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;

  const record = obj as Record<string, unknown>;

  // 尝试常见的内容字段路径（按优先级排序）
  const candidates: (string | undefined)[] = [
    // 直接 content 字段
    typeof record.content === 'string' ? record.content : undefined,
    // OpenAI / 兼容格式: choices[0].delta.content
    typeof (record.choices as Array<{ delta?: { content?: string | null } }>)?.[0]?.delta
      ?.content === 'string'
      ? (record.choices as Array<{ delta?: { content?: string } }>)[0].delta!.content
      : undefined,
    // 嵌套 message.content
    typeof (record.message as Record<string, unknown>)?.content === 'string'
      ? String((record.message as Record<string, unknown>).content)
      : undefined,
    // 简单 message 字符串
    typeof record.message === 'string' ? record.message : undefined,
    // data.content 嵌套格式
    typeof (record.data as Record<string, unknown>)?.content === 'string'
      ? String((record.data as Record<string, unknown>).content)
      : undefined,
    // data.text 嵌套格式
    typeof (record.data as Record<string, unknown>)?.text === 'string'
      ? String((record.data as Record<string, unknown>).text)
      : undefined,
    // data 字符串格式
    typeof record.data === 'string' ? record.data : undefined,
    // result.text 嵌套格式
    typeof (record.result as Record<string, unknown>)?.text === 'string'
      ? String((record.result as Record<string, unknown>).text)
      : undefined,
    // result 字符串格式
    typeof record.result === 'string' ? record.result : undefined,
    // output 字符串格式
    typeof record.output === 'string' ? record.output : undefined,
    // body 字符串格式
    typeof record.body === 'string' ? record.body : undefined,
    // reply 字段
    typeof record.reply === 'string' ? record.reply : undefined,
    // text 字段
    typeof record.text === 'string' ? record.text : undefined,
    // response 字段
    typeof record.response === 'string' ? record.response : undefined,
    // answer 字段
    typeof record.answer === 'string' ? record.answer : undefined,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate.length > 0) {
      return candidate;
    }
  }
  return '';
}

// ============================================
// API接口导出
// ============================================

export const api = {
  // ---- 聊天相关接口 ----

  /**
   * 发送聊天消息
   * @param text 用户输入文本
   * @param personality 个性模式：mambo(曼波)/baihua(白话)/drama(戏精)
   * @returns 曼波的回复及情绪状态
   */
  chat: (text: string, personality?: string): Promise<ChatResponse> =>
    request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({
        text,
        personality: personality || 'mambo',
        // 包含上下文信息
        context: {
          timestamp: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
        },
      }),
    }),

  /**
   * 流式发送聊天消息（逐字返回）
   * @param text 用户输入文本
   * @param personality 个性模式
   * @param onChunk 每次收到新内容的回调
   */
  chatStream: async (
    text: string,
    personality: string | undefined = 'mambo',
    onChunk: (chunk: { content: string; done: boolean }) => void,
  ): Promise<void> => {
    const url = `${API_BASE_URL}/chat/stream`;
    const token = getAuthToken();
    const deviceId = localStorage.getItem('mambo_device_id') || generateDeviceId();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Device-ID': deviceId,
      },
      body: JSON.stringify({ text, personality: personality || 'mambo' }),
    });

    if (!response.ok) {
      throw new ApiError('流式请求失败', response.status);
    }

    // 读取SSE流
    const reader = response.body?.getReader();
    if (!reader) throw new ApiError('无法读取响应流');

    const decoder = new TextDecoder();
    // 行缓冲区：处理跨 read() 边界的 SSE 事件（关键修复）
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 将新数据追加到缓冲区（关键修复：避免跨块数据丢失）
        buffer += decoder.decode(value, { stream: true });

        // 按行分割，保留最后一个可能不完整的行在缓冲区中
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 最后一行可能不完整，留到下一次处理

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') {
              onChunk({ content: '', done: true });
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = extractContentFromSSE(parsed);
              // 关键修复：只发送有实际内容的 chunk，避免空字符串污染累积内容
              if (content && content.length > 0) {
                onChunk({ content, done: false });
              }
            } catch {
              // 非JSON格式时，如果data有实际内容，直接作为文本返回
              if (data && data !== '[DONE]') {
                onChunk({ content: data, done: false });
              }
            }
          }
        }
      }

      // 处理缓冲区中剩余的数据（流结束后的最后一块）
      if (buffer.startsWith('data: ')) {
        const data = buffer.substring(6);
        if (data === '[DONE]') {
          onChunk({ content: '', done: true });
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = extractContentFromSSE(parsed);
          if (content && content.length > 0) {
            onChunk({ content, done: false });
          }
        } catch {
          if (data && data !== '[DONE]') {
            onChunk({ content: data, done: false });
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  /**
   * 获取对话历史记录
   * @returns 消息列表
   */
  getHistory: (): Promise<{ messages: Message[]; hasMore: boolean }> =>
    request('/chat/history', {
      method: 'GET',
    }),

  /**
   * 获取曼波当前情绪状态
   * @returns 情绪状态详情
   */
  getMood: (): Promise<EmotionState> =>
    request('/mood', {
      method: 'GET',
    }),

  /**
   * 清空对话历史
   */
  clearHistory: (): Promise<{ success?: boolean }> =>
    request('/chat/history', {
      method: 'DELETE',
    }),

  // ---- 语音相关接口 ----

  /**
   * 将文本转换为语音（TTS）
   * @param text 要转换的文本
   * @returns 音频Blob
   */
  textToSpeech: async (text: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new ApiError('语音合成失败', response.status);
    }

    return response.blob();
  },

  /**
   * 上传语音文件进行识别（STT）
   * @param audioBlob 录音的音频Blob
   * @returns 识别出的文本
   */
  speechToText: async (audioBlob: Blob): Promise<{ text: string; confidence: number }> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(`${API_BASE_URL}/stt`, {
      method: 'POST',
      headers: {
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new ApiError('语音识别失败', response.status);
    }

    return response.json();
  },

  // ---- 用户相关接口 ----

  /**
   * 获取用户统计信息（亲密度、对话次数等）
   */
  getStats: (): Promise<{
    intimacy: number;
    totalMessages: number;
    favoriteEmotion: Emotion;
    streakDays: number;
  }> => request('/user/stats'),

  // ---- 健康检查 ----

  /**
   * 检查后端服务健康状态
   */
  healthCheck: (): Promise<{ status: string; version: string; uptime: number }> =>
    request('/health', { method: 'GET' }, { auth: false }),
};

export default api;

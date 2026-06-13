/**
 * ============================================
 * store.ts — 记忆存储模块
 * ============================================
 * 功能：将对话内容转换为向量嵌入并持久化到PostgreSQL
 * - 调用DeepSeek API生成embedding向量
 * - 存储对话文本、时间戳、情绪状态、亲密度变化
 * - 对话超过10轮后自动触发摘要生成
 *
 * @module memory/store
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// 类型定义
// ============================================

/** 单条记忆的完整数据结构 */
export interface Memory {
  /** 唯一标识符 (UUID) */
  id: string;
  /** 关联的用户ID */
  userId: string;
  /** 对话文本内容 */
  text: string;
  /** 1536维向量嵌入 (pgvector) */
  embedding: number[];
  /** 情绪状态标签，如 "happy", "sad", "excited" */
  emotion: string;
  /** 亲密度变化值 (-10 ~ +10) */
  intimacyDelta: number;
  /** 创建时间 */
  createdAt: Date;
  /** 自动生成的对话摘要 (可选) */
  summary?: string;
}

/** 创建记忆时的输入数据（不含id和embedding，由系统自动生成） */
export interface MemoryInput {
  userId: string;
  text: string;
  emotion: string;
  intimacyDelta: number;
  summary?: string;
}

/** 数据库连接池配置选项 */
export interface StoreOptions {
  /** PostgreSQL连接池，外部传入复用 */
  pool: Pool;
  /** Embedding服务提供商，默认 'deepseek' */
  embeddingProvider?: 'deepseek' | 'local';
  /** DeepSeek API密钥 */
  deepseekApiKey?: string;
  /** DeepSeek API基础URL */
  deepseekBaseUrl?: string;
  /** 本地embedding模型服务地址 */
  localEmbeddingUrl?: string;
  /** 触发自动摘要的对话轮数阈值 */
  summaryThreshold?: number;
}

// ============================================
// Embedding服务 — 向量生成
// ============================================

/**
 * 获取文本的向量嵌入（1536维）
 * 优先使用DeepSeek API，失败时可回退到本地模型
 *
 * @param text - 需要向量化的文本
 * @param options - 存储配置选项
 * @returns 1536维浮点数向量
 * @throws 当API调用失败时抛出异常
 */
export async function getEmbedding(
  text: string,
  options: Pick<
    StoreOptions,
    'embeddingProvider' | 'deepseekApiKey' | 'deepseekBaseUrl' | 'localEmbeddingUrl'
  >
): Promise<number[]> {
  const provider = options.embeddingProvider ?? 'deepseek';

  if (provider === 'deepseek') {
    return await getDeepSeekEmbedding(text, options);
  }

  return await getLocalEmbedding(text, options.localEmbeddingUrl);
}

/**
 * 调用DeepSeek Embedding API生成向量
 * 模型：deepseek-embedding，输出维度1536
 *
 * @param text - 输入文本
 * @param options - API配置
 * @returns 1536维向量
 */
async function getDeepSeekEmbedding(
  text: string,
  options: Pick<StoreOptions, 'deepseekApiKey' | 'deepseekBaseUrl'>
): Promise<number[]> {
  const apiKey = options.deepseekApiKey;
  if (!apiKey) {
    throw new Error('[MemoryStore] 未配置DeepSeek API密钥 (deepseekApiKey)');
  }

  const baseUrl = options.deepseekBaseUrl ?? 'https://api.deepseek.com';

  // DeepSeek对输入长度有限制，超长文本需要截断
  const trimmedText = text.length > 8000 ? text.slice(0, 8000) : text;

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-embedding',
      input: trimmedText,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `[MemoryStore] DeepSeek Embedding API 调用失败: ${response.status} - ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
    model: string;
    usage: { prompt_tokens: number; total_tokens: number };
  };

  const embedding = data.data[0]?.embedding;

  if (!embedding || embedding.length === 0) {
    throw new Error('[MemoryStore] DeepSeek返回了空的embedding向量');
  }

  console.log(
    `[MemoryStore] Embedding生成成功，维度=${embedding.length}, tokens=${data.usage.total_tokens}`
  );

  return embedding;
}

/**
 * 调用本地轻量级Embedding模型生成向量
 * 适用于离线环境或对延迟敏感的场景
 *
 * @param text - 输入文本
 * @param localUrl - 本地模型服务地址，默认 http://localhost:8000/embed
 * @returns 1536维向量
 */
async function getLocalEmbedding(
  text: string,
  localUrl?: string
): Promise<number[]> {
  const url = localUrl ?? 'http://localhost:8000/embed';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(
      `[MemoryStore] 本地Embedding服务调用失败: ${response.status}`
    );
  }

  const data = (await response.json()) as { embedding: number[] };

  if (!data.embedding || data.embedding.length === 0) {
    throw new Error('[MemoryStore] 本地模型返回了空的embedding向量');
  }

  return data.embedding;
}

// ============================================
// 记忆存储核心逻辑
// ============================================

/**
 * 将单条记忆存入PostgreSQL数据库
 * 流程：
 *   1. 调用Embedding API将文本转为1536维向量
 *   2. 插入memories表（含vector列）
 *   3. 检查该用户是否需要触发自动摘要
 *
 * @param input - 记忆输入数据（不含id和embedding）
 * @param options - 数据库和API配置
 * @returns 完整的记忆记录（含生成的id和embedding）
 */
export async function storeMemory(
  input: MemoryInput,
  options: StoreOptions
): Promise<Memory> {
  const pool = options.pool;

  // 1. 生成向量嵌入
  const embedding = await getEmbedding(input.text, options);

  // 2. 构造完整记忆对象
  const memory: Memory = {
    id: uuidv4(),
    userId: input.userId,
    text: input.text,
    embedding,
    emotion: input.emotion,
    intimacyDelta: input.intimacyDelta,
    createdAt: new Date(),
    summary: input.summary,
  };

  // 3. 写入数据库
  const client = await pool.connect();
  try {
    // 使用参数化查询防止SQL注入
    // embedding使用pgvector的to_vector语法：::vector
    const query = `
      INSERT INTO memories (id, user_id, text, embedding, emotion, intimacy_delta, created_at, summary)
      VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8)
      RETURNING id
    `;

    await client.query(query, [
      memory.id,
      memory.userId,
      memory.text,
      JSON.stringify(memory.embedding), // pgvector需要JSON数组字符串格式
      memory.emotion,
      memory.intimacyDelta,
      memory.createdAt,
      memory.summary ?? null,
    ]);

    console.log(
      `[MemoryStore] 记忆已存储: id=${memory.id}, user=${memory.userId}, emotion=${memory.emotion}`
    );

    // 4. 检查是否需要触发自动摘要
    await checkAndTriggerSummary(client, input.userId, options.summaryThreshold);

    return memory;
  } finally {
    client.release();
  }
}

/**
 * 批量存储多条记忆（用于导入历史对话）
 * 使用事务确保原子性
 *
 * @param inputs - 多条记忆输入
 * @param options - 配置选项
 * @returns 存储成功的记忆记录数组
 */
export async function storeMemoriesBatch(
  inputs: MemoryInput[],
  options: StoreOptions
): Promise<Memory[]> {
  if (inputs.length === 0) return [];

  const pool = options.pool;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const memories: Memory[] = [];

    for (const input of inputs) {
      const embedding = await getEmbedding(input.text, options);

      const memory: Memory = {
        id: uuidv4(),
        userId: input.userId,
        text: input.text,
        embedding,
        emotion: input.emotion,
        intimacyDelta: input.intimacyDelta,
        createdAt: new Date(),
        summary: input.summary,
      };

      await client.query(
        `
        INSERT INTO memories (id, user_id, text, embedding, emotion, intimacy_delta, created_at, summary)
        VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8)
      `,
        [
          memory.id,
          memory.userId,
          memory.text,
          JSON.stringify(memory.embedding),
          memory.emotion,
          memory.intimacyDelta,
          memory.createdAt,
          memory.summary ?? null,
        ]
      );

      memories.push(memory);
    }

    await client.query('COMMIT');

    console.log(`[MemoryStore] 批量存储完成: ${memories.length} 条记忆`);

    return memories;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// 自动摘要触发逻辑
// ============================================

/**
 * 检查用户是否需要触发自动摘要
 * 当该用户最近未摘要的对话轮数超过阈值时，触发摘要生成
 *
 * @param client - 数据库连接客户端
 * @param userId - 用户ID
 * @param threshold - 触发阈值（默认10轮）
 */
async function checkAndTriggerSummary(
  client: PoolClient,
  userId: string,
  threshold: number = 10
): Promise<void> {
  // 查询该用户自上次摘要以来的对话数量
  const result = await client.query(
    `
    SELECT COUNT(*) as count
    FROM memories
    WHERE user_id = $1
      AND (summary IS NULL OR summary = '')
      AND created_at > (
        SELECT MAX(created_at)
        FROM memories
        WHERE user_id = $1 AND summary IS NOT NULL AND summary != ''
      )
  `,
    [userId]
  );

  const count = parseInt(result.rows[0]?.count ?? '0', 10);

  if (count >= threshold) {
    console.log(
      `[MemoryStore] 用户 ${userId} 已达到摘要阈值 (${count}/${threshold})，准备生成摘要...`
    );

    // 触发异步摘要生成（不阻塞主流程）
    // 实际项目中这里可以调用 summarize.ts 中的 summarizeConversation
    // 为避免循环依赖，此处通过事件或回调方式触发
    triggerAsyncSummary(userId);
  }
}

/** 需要外部注入的摘要回调函数 */
let summaryCallback: ((userId: string) => Promise<void>) | null = null;

/**
 * 注册摘要触发回调
 * 用于解耦 store.ts 和 summarize.ts 的循环依赖
 *
 * @param callback - 摘要生成回调函数
 */
export function registerSummaryCallback(
  callback: (userId: string) => Promise<void>
): void {
  summaryCallback = callback;
}

/** 触发异步摘要生成 */
function triggerAsyncSummary(userId: string): void {
  if (summaryCallback) {
    // 异步执行，不等待结果
    summaryCallback(userId).catch((err) => {
      console.error(`[MemoryStore] 自动摘要生成失败: user=${userId}`, err);
    });
  }
}

// ============================================
// 记忆删除与更新
// ============================================

/**
 * 根据ID删除单条记忆
 *
 * @param pool - 数据库连接池
 * @param memoryId - 记忆ID
 * @returns 是否删除成功
 */
export async function deleteMemory(pool: Pool, memoryId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM memories WHERE id = $1', [memoryId]);
  const deleted = (result.rowCount ?? 0) > 0;

  if (deleted) {
    console.log(`[MemoryStore] 记忆已删除: id=${memoryId}`);
  }

  return deleted;
}

/**
 * 更新记忆的摘要内容
 *
 * @param pool - 数据库连接池
 * @param memoryId - 记忆ID
 * @param summary - 新的摘要内容
 * @returns 是否更新成功
 */
export async function updateMemorySummary(
  pool: Pool,
  memoryId: string,
  summary: string
): Promise<boolean> {
  const result = await pool.query(
    'UPDATE memories SET summary = $1 WHERE id = $2',
    [summary, memoryId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================
// 使用示例
// ============================================

/*
// ====== 示例：基础用法 ======

import { Pool } from 'pg';
import { storeMemory, getEmbedding, registerSummaryCallback } from './store';
import { summarizeConversation } from './summarize';

// 1. 创建PostgreSQL连接池
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mambo_memory',
  user: 'postgres',
  password: 'your_password',
});

// 2. 注册摘要回调（解耦）
registerSummaryCallback(async (userId: string) => {
  const summary = await summarizeConversation(userId);
  console.log('自动摘要生成完成:', summary);
});

// 3. 存储一条新记忆
const memory = await storeMemory(
  {
    userId: 'user_001',
    text: '用户说：今天天气真好，我想去公园散步。\n曼波回复：好呀好呀！要不要我陪你一起规划路线？',
    emotion: 'happy',
    intimacyDelta: 2,
  },
  {
    pool,
    embeddingProvider: 'deepseek',
    deepseekApiKey: process.env.DEEPSEEK_API_KEY!,
  }
);

console.log('记忆存储成功:', memory.id);

// ====== 示例：批量导入历史对话 ======

const historyMessages = [
  { userId: 'user_001', text: '你好，我是小明', emotion: 'neutral', intimacyDelta: 1 },
  { userId: 'user_001', text: '今天工作好累啊', emotion: 'tired', intimacyDelta: 1 },
  { userId: 'user_001', text: '谢谢你陪我聊天', emotion: 'grateful', intimacyDelta: 3 },
];

const memories = await storeMemoriesBatch(historyMessages, {
  pool,
  embeddingProvider: 'deepseek',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY!,
});

console.log(`成功导入 ${memories.length} 条历史记忆`);
*/

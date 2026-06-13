/**
 * ============================================
 * retrieve.ts — 记忆检索模块
 * ============================================
 * 功能：基于向量相似度的语义检索 + 多维度过滤
 * - 将查询文本转为向量，使用pgvector的<->算子计算L2距离
 * - 支持时间范围过滤（今日/本周/本月/全部）
 * - 支持情绪标签过滤
 * - 支持混合检索（向量相似度 + 时间衰减加权）
 *
 * @module memory/retrieve
 */

import { Pool } from 'pg';
import { Memory } from './store';
import { getEmbedding } from './store';

// ============================================
// 类型定义
// ============================================

/** 检索配置选项 */
export interface RetrieveOptions {
  /** 目标用户ID（强制隔离，不会返回其他用户的数据） */
  userId: string;
  /** 自然语言查询文本，将自动转为向量进行语义检索 */
  query: string;
  /** 返回结果数量上限，默认3条 */
  limit?: number;
  /** 时间范围过滤，默认'all' */
  timeRange?: 'day' | 'week' | 'month' | 'all';
  /** 情绪标签过滤（可选），如 "happy", "sad" */
  emotion?: string;
  /** 是否启用时间衰减加权（越新的记忆权重越高），默认true */
  useTimeDecay?: boolean;
}

/** 检索结果项（含相似度分数） */
export interface RetrievedMemory extends Memory {
  /** 向量相似度分数 (0-1，越接近1越相似) */
  similarity: number;
}

/** Embedding服务配置（复用store的配置） */
export interface EmbeddingConfig {
  embeddingProvider?: 'deepseek' | 'local';
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  localEmbeddingUrl?: string;
}

// ============================================
// 主检索函数
// ============================================

/**
 * 多维度记忆检索入口
 * 执行流程：
 *   1. 将查询文本转为embedding向量
 *   2. 构建SQL查询（向量相似度排序 + 用户隔离 + 时间过滤 + 情绪过滤）
 *   3. 可选：应用时间衰减加权
 *   4. 返回最相关的N条记忆
 *
 * @param options - 检索选项
 * @param pool - PostgreSQL连接池
 * @param embedConfig - Embedding服务配置
 * @returns 按相关性排序的记忆列表
 */
export async function retrieveMemories(
  options: RetrieveOptions,
  pool: Pool,
  embedConfig: EmbeddingConfig
): Promise<RetrievedMemory[]> {
  const {
    userId,
    query,
    limit = 3,
    timeRange = 'all',
    emotion,
    useTimeDecay = true,
  } = options;

  // 1. 将查询转为向量
  const queryEmbedding = await getEmbedding(query, embedConfig);

  // 2. 构建SQL条件
  const conditions: string[] = ['user_id = $1'];
  const params: (string | number | Date)[] = [userId];
  let paramIndex = 2;

  // 时间范围过滤
  const timeCondition = buildTimeRangeCondition(timeRange, paramIndex);
  if (timeCondition) {
    conditions.push(timeCondition.sql);
    params.push(timeCondition.value);
    paramIndex++;
  }

  // 情绪过滤
  if (emotion) {
    conditions.push(`emotion = $${paramIndex}`);
    params.push(emotion);
    paramIndex++;
  }

  // 3. 执行向量检索
  const whereClause = conditions.join(' AND ');
  const vectorParam = JSON.stringify(queryEmbedding);

  let sql: string;

  if (useTimeDecay) {
    // 启用时间衰减：相似度 * 时间衰减因子
    // 衰减公式：exp(-λ * days_ago)，λ=0.1 表示约7天后权重减半
    sql = `
      SELECT
        id,
        user_id as "userId",
        text,
        embedding,
        emotion,
        intimacy_delta as "intimacyDelta",
        created_at as "createdAt",
        summary,
        -- 综合分数：向量相似度(70%) + 时间衰减(30%)
        (
          (1 - (embedding <=> $${paramIndex}::vector)) * 0.7 +
          EXP(-0.1 * EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) * 0.3
        ) as similarity
      FROM memories
      WHERE ${whereClause}
      ORDER BY similarity DESC
      LIMIT $${paramIndex + 1}
    `;
  } else {
    // 纯向量相似度排序（L2距离越小越相似，1 - distance 归一化到0-1）
    sql = `
      SELECT
        id,
        user_id as "userId",
        text,
        embedding,
        emotion,
        intimacy_delta as "intimacyDelta",
        created_at as "createdAt",
        summary,
        1 - (embedding <=> $${paramIndex}::vector) as similarity
      FROM memories
      WHERE ${whereClause}
      ORDER BY embedding <=> $${paramIndex}::vector
      LIMIT $${paramIndex + 1}
    `;
  }

  params.push(vectorParam, limit);

  const result = await pool.query(sql, params);

  const memories: RetrievedMemory[] = result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    text: row.text,
    embedding: row.embedding,
    emotion: row.emotion,
    intimacyDelta: row.intimacyDelta,
    createdAt: row.createdAt,
    summary: row.summary,
    similarity: Math.round(parseFloat(row.similarity) * 10000) / 10000, // 保留4位小数
  }));

  console.log(
    `[MemoryRetrieve] 检索完成: query="${query}", 用户=${userId}, 范围=${timeRange}, 返回=${memories.length}条`
  );

  return memories;
}

/**
 * 纯向量语义搜索（不过滤用户，用于内部调用）
 * 使用pgvector的L2距离算子 <=> 进行最邻近搜索
 *
 * @param embedding - 查询向量
 * @param limit - 返回数量
 * @param pool - 数据库连接池
 * @param userId - 可选：指定用户ID进行隔离
 * @returns 按相似度排序的记忆列表
 */
export async function semanticSearch(
  embedding: number[],
  limit: number,
  pool: Pool,
  userId?: string
): Promise<Memory[]> {
  const vectorParam = JSON.stringify(embedding);

  let sql: string;
  let params: (string | number)[];

  if (userId) {
    sql = `
      SELECT
        id,
        user_id as "userId",
        text,
        embedding,
        emotion,
        intimacy_delta as "intimacyDelta",
        created_at as "createdAt",
        summary,
        1 - (embedding <=> $1::vector) as similarity
      FROM memories
      WHERE user_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;
    params = [vectorParam, userId, limit];
  } else {
    sql = `
      SELECT
        id,
        user_id as "userId",
        text,
        embedding,
        emotion,
        intimacy_delta as "intimacyDelta",
        created_at as "createdAt",
        summary,
        1 - (embedding <=> $1::vector) as similarity
      FROM memories
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;
    params = [vectorParam, limit];
  }

  const result = await pool.query(sql, params);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    text: row.text,
    embedding: row.embedding,
    emotion: row.emotion,
    intimacyDelta: row.intimacyDelta,
    createdAt: row.createdAt,
    summary: row.summary,
  }));
}

// ============================================
// 辅助检索函数
// ============================================

/**
 * 检索用户最近N条记忆（按时间倒序）
 * 用于快速获取最新对话上下文
 *
 * @param pool - 数据库连接池
 * @param userId - 用户ID
 * @param limit - 返回数量，默认10
 * @returns 最近的记忆列表
 */
export async function getRecentMemories(
  pool: Pool,
  userId: string,
  limit: number = 10
): Promise<Memory[]> {
  const result = await pool.query(
    `
    SELECT
      id,
      user_id as "userId",
      text,
      embedding,
      emotion,
      intimacy_delta as "intimacyDelta",
      created_at as "createdAt",
      summary
    FROM memories
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `,
    [userId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    text: row.text,
    embedding: row.embedding,
    emotion: row.emotion,
    intimacyDelta: row.intimacyDelta,
    createdAt: row.createdAt,
    summary: row.summary,
  }));
}

/**
 * 按情绪标签检索记忆
 * 用于"找找之前开心/难过的回忆"这类场景
 *
 * @param pool - 数据库连接池
 * @param userId - 用户ID
 * @param emotion - 情绪标签
 * @param limit - 返回数量，默认5
 * @returns 匹配情绪的记忆列表
 */
export async function getMemoriesByEmotion(
  pool: Pool,
  userId: string,
  emotion: string,
  limit: number = 5
): Promise<Memory[]> {
  const result = await pool.query(
    `
    SELECT
      id,
      user_id as "userId",
      text,
      embedding,
      emotion,
      intimacy_delta as "intimacyDelta",
      created_at as "createdAt",
      summary
    FROM memories
    WHERE user_id = $1 AND emotion = $2
    ORDER BY created_at DESC
    LIMIT $3
  `,
    [userId, emotion, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    text: row.text,
    embedding: row.embedding,
    emotion: row.emotion,
    intimacyDelta: row.intimacyDelta,
    createdAt: row.createdAt,
    summary: row.summary,
  }));
}

/**
 * 获取指定时间范围内的记忆统计
 * 用于生成日报或分析用户活跃时段
 *
 * @param pool - 数据库连接池
 * @param userId - 用户ID
 * @param timeRange - 时间范围
 * @returns 统计信息
 */
export async function getMemoryStats(
  pool: Pool,
  userId: string,
  timeRange: 'day' | 'week' | 'month' | 'all' = 'week'
): Promise<{
  total: number;
  emotionDistribution: Record<string, number>;
  avgIntimacyDelta: number;
}> {
  const timeCondition = buildTimeRangeCondition(timeRange, 2);
  const whereClause = timeCondition
    ? `user_id = $1 AND ${timeCondition.sql}`
    : 'user_id = $1';
  const params: (string | number | Date)[] = [userId];
  if (timeCondition) {
    params.push(timeCondition.value);
  }

  // 总数统计
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM memories WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

  // 情绪分布
  const emotionResult = await pool.query(
    `
    SELECT emotion, COUNT(*) as count
    FROM memories
    WHERE ${whereClause}
    GROUP BY emotion
    ORDER BY count DESC
  `,
    params
  );

  const emotionDistribution: Record<string, number> = {};
  for (const row of emotionResult.rows) {
    emotionDistribution[row.emotion] = parseInt(row.count, 10);
  }

  // 平均亲密度变化
  const intimacyResult = await pool.query(
    `SELECT AVG(intimacy_delta) as avg FROM memories WHERE ${whereClause}`,
    params
  );
  const avgIntimacyDelta =
    Math.round(parseFloat(intimacyResult.rows[0]?.avg ?? '0') * 100) / 100;

  return { total, emotionDistribution, avgIntimacyDelta };
}

// ============================================
// 工具函数
// ============================================

/**
 * 构建时间范围SQL条件
 * 支持动态参数索引
 */
function buildTimeRangeCondition(
  range: 'day' | 'week' | 'month' | 'all',
  paramIndex: number
): { sql: string; value: Date } | null {
  const now = new Date();

  switch (range) {
    case 'day': {
      // 最近24小时
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return {
        sql: `created_at >= $${paramIndex}`,
        value: dayAgo,
      };
    }
    case 'week': {
      // 最近7天
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        sql: `created_at >= $${paramIndex}`,
        value: weekAgo,
      };
    }
    case 'month': {
      // 最近30天
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return {
        sql: `created_at >= $${paramIndex}`,
        value: monthAgo,
      };
    }
    case 'all':
    default:
      // 不限制
      return null;
  }
}

// ============================================
// 使用示例
// ============================================

/*
// ====== 示例：基础语义检索 ======

import { Pool } from 'pg';
import { retrieveMemories } from './retrieve';

const pool = new Pool({
  host: 'localhost',
  database: 'mambo_memory',
  user: 'postgres',
  password: 'your_password',
});

const embedConfig = {
  embeddingProvider: 'deepseek' as const,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY!,
};

// 用户问了一个关于之前话题的问题
const relevantMemories = await retrieveMemories(
  {
    userId: 'user_001',
    query: '之前说过喜欢吃什么？',  // 自然语言查询，自动转向量
    limit: 3,
    timeRange: 'all',  // 搜索全部历史
  },
  pool,
  embedConfig
);

for (const mem of relevantMemories) {
  console.log(`[相似度 ${mem.similarity}] ${mem.text}`);
}

// ====== 示例：检索最近一周的快乐记忆 ======

const happyMemories = await retrieveMemories(
  {
    userId: 'user_001',
    query: '开心的回忆',
    limit: 5,
    timeRange: 'week',
    emotion: 'happy',
  },
  pool,
  embedConfig
);

// ====== 示例：获取最新对话上下文 ======

const recentContext = await getRecentMemories(pool, 'user_001', 5);
// 可用于构建LLM的对话上下文

// ====== 示例：记忆统计 ======

const stats = await getMemoryStats(pool, 'user_001', 'week');
console.log('本周记忆统计:', stats);
// 输出: { total: 42, emotionDistribution: { happy: 20, calm: 15, sad: 7 }, avgIntimacyDelta: 1.5 }
*/

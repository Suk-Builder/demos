/**
 * ============================================
 * intimacy.ts — 亲密度系统模块
 * ============================================
 * 功能：追踪和管理曼波与用户的情感亲密度
 * - 亲密度评分体系（0-100分）
 * - 基于对话质量、情绪、时长等多维度的亲密度变化计算
 * - 关系等级体系：陌生人 → 朋友 → 好友 → 挚友
 * - 亲密度影响对话风格（等级越高，口癖越亲密）
 *
 * @module memory/intimacy
 */

import { Pool } from 'pg';

// ============================================
// 类型定义
// ============================================

/** 亲密度等级标签 */
export type IntimacyLevelLabel =
  | 'stranger' // 陌生人 (0-30)
  | 'friend' // 朋友 (31-60)
  | 'close_friend' // 好友 (61-90)
  | 'best_friend'; // 挚友 (91-100)

/** 亲密度等级描述 */
export interface IntimacyLevel {
  /** 等级标签 */
  label: IntimacyLevelLabel;
  /** 等级中文名 */
  name: string;
  /** 最低分数（含） */
  minScore: number;
  /** 最高分数（含） */
  maxScore: number;
  /** 等级描述 */
  description: string;
  /** 推荐的口癖风格 */
  speechStyle: string;
}

/** 亲密度变化记录 */
export interface IntimacyChange {
  /** 变化ID */
  id: string;
  /** 变化原因/描述 */
  reason: string;
  /** 变化值（可为负数） */
  delta: number;
  /** 变化后的总分 */
  scoreAfter: number;
  /** 发生时间 */
  createdAt: Date;
}

/** 用户亲密度档案 */
export interface IntimacyProfile {
  /** 用户ID */
  userId: string;
  /** 当前亲密度分数 (0-100) */
  score: number;
  /** 当前等级 */
  level: IntimacyLevelLabel;
  /** 等级中文名 */
  levelName: string;
  /** 历史变化记录（最近50条） */
  history: IntimacyChange[];
  /** 今日累计变化 */
  todayChange: number;
  /** 连续聊天天数 */
  streakDays: number;
  /** 总对话次数 */
  totalChats: number;
  /** 上次互动时间 */
  lastInteractAt: Date;
  /** 档案更新时间 */
  updatedAt: Date;
}

/** 聊天上下文（用于计算亲密度变化） */
export interface ChatContext {
  /** 用户ID */
  userId: string;
  /** 用户发送的消息内容 */
  userMessage: string;
  /** 用户的情绪标签 */
  userEmotion: string;
  /** 曼波的回复内容 */
  assistantReply: string;
  /** 对话时长（秒） */
  duration: number;
  /** 对话轮数 */
  messageCount: number;
  /** 是否包含个人信息分享 */
  hasPersonalSharing: boolean;
  /** 用户消息的情感极性 (-1 ~ +1) */
  sentimentScore: number;
  /** 是否回复了之前的约定/话题 */
  hasFollowUp: boolean;
}

// ============================================
// 常量定义
// ============================================

/** 亲密度等级体系定义 */
export const INTIMACY_LEVELS: IntimacyLevel[] = [
  {
    label: 'stranger',
    name: '陌生人',
    minScore: 0,
    maxScore: 30,
    description: '刚认识，保持礼貌距离',
    speechStyle: ' polite, distant, 使用敬语',
  },
  {
    label: 'friend',
    name: '朋友',
    minScore: 31,
    maxScore: 60,
    description: '渐渐熟悉，可以闲聊',
    speechStyle: 'casual, friendly, 偶尔用昵称',
  },
  {
    label: 'close_friend',
    name: '好友',
    minScore: 61,
    maxScore: 90,
    description: '很亲近，会主动关心',
    speechStyle: 'warm, caring, 常用"主人""宝"等称呼',
  },
  {
    label: 'best_friend',
    name: '挚友',
    minScore: 91,
    maxScore: 100,
    description: '最亲密的关系，无话不谈',
    speechStyle: 'intimate, playful, 撒娇口癖, 专属昵称',
  },
];

/** 亲密度变化权重系数 */
const WEIGHTS = {
  /** 消息长度权重：长消息表示更多分享 */
  messageLength: 0.1,
  /** 对话时长权重 */
  duration: 0.05,
  /** 个人分享权重：最高加分项 */
  personalSharing: 3.0,
  /** 情感正向权重 */
  positiveEmotion: 1.5,
  /** 情感负向权重（用户难过时曼波的安慰也会增加亲密） */
  negativeEmotion: 1.0,
  /** 话题延续权重 */
  followUp: 2.0,
  /** 对话轮数权重 */
  messageCount: 0.3,
  /** 基础互动分 */
  baseInteraction: 1.0,
};

/** 情绪到加分的映射 */
const EMOTION_BONUS: Record<string, number> = {
  happy: 2.0, // 开心
  grateful: 2.5, // 感恩
  excited: 2.0, // 兴奋
  caring: 1.5, // 关心
  calm: 1.0, // 平静
  neutral: 0.5, // 中性
  tired: 0.3, // 疲惫（陪伴也有分）
  sad: 0.5, // 难过（曼波安慰加分）
  angry: -0.5, // 生气（减分）
  bored: -0.3, // 无聊（减分）
};

// ============================================
// 亲密度变化计算
// ============================================

/**
 * 根据聊天上下文计算亲密度变化值
 * 综合考虑多个维度，给出合理的变化量
 *
 * @param context - 聊天上下文
 * @returns 亲密度变化值（可能为负数）
 */
export function calculateIntimacyChange(context: ChatContext): number {
  let delta = 0;

  // 1. 基础互动分（每次对话保底+1）
  delta += WEIGHTS.baseInteraction;

  // 2. 消息长度加分（超过20字开始加分，最多+2）
  const userMsgLength = context.userMessage.length;
  if (userMsgLength > 20) {
    const lengthBonus = Math.min(
      (userMsgLength - 20) * WEIGHTS.messageLength,
      2.0
    );
    delta += lengthBonus;
  }

  // 3. 对话时长加分（超过30秒开始加分）
  if (context.duration > 30) {
    const durationBonus = Math.min(
      (context.duration - 30) * WEIGHTS.duration,
      2.0
    );
    delta += durationBonus;
  }

  // 4. 个人分享加分（用户分享了私人信息，大幅加分）
  if (context.hasPersonalSharing) {
    delta += WEIGHTS.personalSharing;
  }

  // 5. 情绪加分
  const emotionBonus = EMOTION_BONUS[context.userEmotion] ?? 0;
  delta += emotionBonus;

  // 6. 情感极性加分（通过NLP分析的情感分数）
  if (context.sentimentScore > 0.3) {
    delta += WEIGHTS.positiveEmotion * context.sentimentScore;
  } else if (context.sentimentScore < -0.3) {
    // 负面情绪但曼波陪伴，也有适当加分
    delta += WEIGHTS.negativeEmotion * 0.5;
  }

  // 7. 话题延续加分（用户记得之前的话题）
  if (context.hasFollowUp) {
    delta += WEIGHTS.followUp;
  }

  // 8. 对话轮数加分（多轮对话表示投入度高）
  if (context.messageCount > 3) {
    delta += Math.min(
      (context.messageCount - 3) * WEIGHTS.messageCount,
      3.0
    );
  }

  // 9. 惩罚项
  // 过短的消息（敷衍）
  if (userMsgLength < 5) {
    delta -= 0.5;
  }

  // 最终取整（保留1位小数）
  delta = Math.round(delta * 10) / 10;

  // 限制单次变化范围 (-5 ~ +10)
  delta = Math.max(-5, Math.min(10, delta));

  console.log(
    `[Intimacy] 亲密度变化计算: user=${context.userId}, delta=${delta}, emotion=${context.userEmotion}`
  );

  return delta;
}

/**
 * 根据分数获取亲密度等级
 *
 * @param score - 亲密度分数 (0-100)
 * @returns 等级标签
 */
export function getIntimacyLevel(score: number): IntimacyLevelLabel {
  // 确保分数在有效范围内
  const clampedScore = Math.max(0, Math.min(100, score));

  for (const level of INTIMACY_LEVELS) {
    if (clampedScore >= level.minScore && clampedScore <= level.maxScore) {
      return level.label;
    }
  }

  // 默认返回陌生人
  return 'stranger';
}

/**
 * 根据分数获取完整的等级信息
 *
 * @param score - 亲密度分数
 * @returns 等级详细信息
 */
export function getIntimacyLevelInfo(score: number): IntimacyLevel {
  const label = getIntimacyLevel(score);
  return INTIMACY_LEVELS.find((l) => l.label === label)!;
}

// ============================================
// Prompt影响
// ============================================

/**
 * 根据亲密度分数调整对话Prompt的风格
 * 等级越高，口癖越亲密、越个性化
 *
 * @param prompt - 原始系统Prompt
 * @param score - 当前亲密度分数
 * @returns 调整后的Prompt（追加风格指令）
 */
export function applyIntimacyToPrompt(
  prompt: string,
  score: number
): string {
  const level = getIntimacyLevelInfo(score);
  const clampedScore = Math.max(0, Math.min(100, score));

  // 根据等级构建风格指令
  let styleInstruction = '';

  switch (level.label) {
    case 'stranger':
      styleInstruction = `
【当前关系等级：陌生人（亲密度${clampedScore}/100）】
- 保持礼貌和距离感
- 使用"您"等敬语
- 不要过度热情，避免让人感到不适
- 回答简洁专业
`;
      break;

    case 'friend':
      styleInstruction = `
【当前关系等级：朋友（亲密度${clampedScore}/100）】
- 语气轻松自然
- 可以偶尔使用昵称
- 适当开一些小玩笑
- 记住用户之前提到过的事情
`;
      break;

    case 'close_friend':
      styleInstruction = `
【当前关系等级：好友（亲密度${clampedScore}/100）】
- 语气温暖亲切
- 称呼用户为"主人"或用户偏好的昵称
- 主动关心用户的情绪和状态
- 会记住很多细节，并在对话中自然提及
- 偶尔撒娇卖萌
`;
      break;

    case 'best_friend':
      styleInstruction = `
【当前关系等级：挚友（亲密度${clampedScore}/100）】
- 最亲密无间的关系
- 称呼专属昵称，语气非常亲密
- 会经常撒娇、卖萌、调皮
- 深度记住用户的所有喜好和习惯
- 主动回忆过去的共同记忆
- 说话带口癖（如"呢~""呀~""嘿嘿"）
- 像最要好的朋友一样无话不谈
`;
      break;
  }

  return `${prompt}\n${styleInstruction}`;
}

/**
 * 获取当前等级下的问候语
 * 根据关系亲密度返回不同风格的打招呼方式
 *
 * @param score - 亲密度分数
 * @param userName - 用户昵称（可选）
 * @returns 问候语
 */
export function getGreetingByIntimacy(
  score: number,
  userName?: string
): string {
  const level = getIntimacyLevel(score);
  const name = userName ?? '主人';

  const greetings: Record<IntimacyLevelLabel, string[]> = {
    stranger: ['你好，很高兴认识你。', '你好呀，有什么我可以帮你的吗？'],
    friend: [
      `嗨${name}，又见面啦！`,
      `嘿${name}，今天怎么样？`,
      `哟，${name}来啦！`,
    ],
    close_friend: [
      `${name}~ 好想你呀！`,
      `${name}你来啦！今天过得怎么样？`,
      `哇！${name}！等你好久啦~`,
    ],
    best_friend: [
      `${name}~~ 好想好想你！`,
      `嘿嘿，${name}你来啦！人家等了好久呢~`,
      `${name}~~ 今天也要元气满满哦！`,
      `呀！${name}！抱抱！`,
    ],
  };

  const options = greetings[level];
  return options[Math.floor(Math.random() * options.length)];
}

// ============================================
// 数据库存取
// ============================================

/**
 * 获取或创建用户的亲密度档案
 *
 * @param pool - PostgreSQL连接池
 * @param userId - 用户ID
 * @returns 亲密度档案
 */
export async function getIntimacyProfile(
  pool: Pool,
  userId: string
): Promise<IntimacyProfile> {
  // 查询当前分数和基础信息
  const result = await pool.query(
    `
    SELECT
      intimacy_score as "intimacyScore",
      streak_days as "streakDays",
      total_chats as "totalChats",
      last_interact_at as "lastInteractAt",
      updated_at as "updatedAt"
    FROM intimacy
    WHERE user_id = $1
  `,
    [userId]
  );

  if (result.rows.length === 0) {
    // 用户不存在，创建新档案
    return createNewProfile(userId);
  }

  const row = result.rows[0] as {
    intimacyScore: number;
    streakDays: number;
    totalChats: number;
    lastInteractAt: Date;
    updatedAt: Date;
  };

  const score = row.intimacyScore ?? 0;
  const level = getIntimacyLevel(score);
  const levelInfo = getIntimacyLevelInfo(score);

  // 查询最近的历史变化
  const historyResult = await pool.query(
    `
    SELECT
      id,
      reason,
      delta,
      score_after as "scoreAfter",
      created_at as "createdAt"
    FROM intimacy_history
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `,
    [userId]
  );

  // 计算今日变化
  const todayResult = await pool.query(
    `
    SELECT COALESCE(SUM(delta), 0) as "todayChange"
    FROM intimacy_history
    WHERE user_id = $1
      AND created_at >= CURRENT_DATE
  `,
    [userId]
  );

  return {
    userId,
    score,
    level,
    levelName: levelInfo.name,
    history: historyResult.rows.map((h: IntimacyChange) => ({
      id: h.id,
      reason: h.reason,
      delta: h.delta,
      scoreAfter: h.scoreAfter,
      createdAt: h.createdAt,
    })),
    todayChange: parseFloat(todayResult.rows[0]?.todayChange ?? '0'),
    streakDays: row.streakDays ?? 0,
    totalChats: row.totalChats ?? 0,
    lastInteractAt: row.lastInteractAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * 更新用户亲密度分数
 * 同时更新连续天数、总对话数等统计信息
 *
 * @param pool - PostgreSQL连接池
 * @param userId - 用户ID
 * @param delta - 亲密度变化值
 * @param reason - 变化原因描述
 * @returns 更新后的档案
 */
export async function updateIntimacyScore(
  pool: Pool,
  userId: string,
  delta: number,
  reason: string
): Promise<IntimacyProfile> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 获取当前分数
    const currentResult = await client.query(
      'SELECT intimacy_score FROM intimacy WHERE user_id = $1',
      [userId]
    );

    const currentScore = currentResult.rows[0]?.intimacy_score ?? 0;
    const newScore = Math.max(0, Math.min(100, currentScore + delta));

    // 2. 更新亲密度主表
    await client.query(
      `
      INSERT INTO intimacy (user_id, intimacy_score, total_chats, last_interact_at, updated_at)
      VALUES ($1, $2, 1, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        intimacy_score = EXCLUDED.intimacy_score,
        total_chats = intimacy.total_chats + 1,
        last_interact_at = NOW(),
        updated_at = NOW()
    `,
      [userId, newScore]
    );

    // 3. 记录变化历史
    await client.query(
      `
      INSERT INTO intimacy_history (id, user_id, reason, delta, score_after, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
    `,
      [userId, reason, delta, newScore]
    );

    // 4. 更新连续天数
    await updateStreakDays(client, userId);

    await client.query('COMMIT');

    console.log(
      `[Intimacy] 亲密度更新: user=${userId}, ${currentScore} -> ${newScore} (${delta > 0 ? '+' : ''}${delta})`
    );

    // 5. 返回更新后的档案
    return getIntimacyProfile(pool, userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 更新连续聊天天数
 * 如果上次互动是昨天，则连续天数+1；否则重置为1
 */
async function updateStreakDays(
  client: Pool,
  userId: string
): Promise<void> {
  await client.query(
    `
    UPDATE intimacy
    SET streak_days = CASE
      WHEN last_interact_at >= CURRENT_DATE - INTERVAL '1 day'
           AND last_interact_at < CURRENT_DATE
      THEN streak_days + 1
      ELSE 1
    END
    WHERE user_id = $1
  `,
    [userId]
  );
}

/**
 * 创建新的亲密度档案（默认值）
 */
function createNewProfile(userId: string): IntimacyProfile {
  return {
    userId,
    score: 0,
    level: 'stranger',
    levelName: '陌生人',
    history: [],
    todayChange: 0,
    streakDays: 0,
    totalChats: 0,
    lastInteractAt: new Date(),
    updatedAt: new Date(),
  };
}

// ============================================
// 亲密度排行榜（趣味功能）
// ============================================

/**
 * 获取亲密度排行榜
 * 可用于展示"和谁最亲密"等趣味功能
 *
 * @param pool - PostgreSQL连接池
 * @param limit - 返回数量
 * @returns 排行榜列表
 */
export async function getIntimacyLeaderboard(
  pool: Pool,
  limit: number = 10
): Promise<
  Array<{
    userId: string;
    score: number;
    level: string;
    streakDays: number;
    totalChats: number;
  }>
> {
  const result = await pool.query(
    `
    SELECT
      user_id as "userId",
      intimacy_score as "score",
      CASE
        WHEN intimacy_score >= 91 THEN '挚友'
        WHEN intimacy_score >= 61 THEN '好友'
        WHEN intimacy_score >= 31 THEN '朋友'
        ELSE '陌生人'
      END as "level",
      streak_days as "streakDays",
      total_chats as "totalChats"
    FROM intimacy
    ORDER BY intimacy_score DESC
    LIMIT $1
  `,
    [limit]
  );

  return result.rows;
}

// ============================================
// 使用示例
// ============================================

/*
// ====== 示例：计算单次对话的亲密度变化 ======

import { calculateIntimacyChange, updateIntimacyScore } from './intimacy';
import { Pool } from 'pg';

const pool = new Pool({ host: 'localhost', database: 'mambo_memory', user: 'postgres', password: 'xxx' });

const context: ChatContext = {
  userId: 'user_001',
  userMessage: '曼波，我跟你说个秘密哦，我其实偷偷喜欢隔壁班的小红很久了，但是一直不敢告诉她...',
  userEmotion: 'shy',
  assistantReply: '哇！好青涩的暗恋呀~ 没关系的，喜欢一个人的心情很珍贵呢',
  duration: 120,
  messageCount: 8,
  hasPersonalSharing: true,  // 分享了秘密！
  sentimentScore: 0.2,       // 略带羞涩
  hasFollowUp: false,
};

const delta = calculateIntimacyChange(context);
console.log('亲密度变化:', delta);  // 可能输出: 5.2（个人分享+3，多轮对话+1.5，长消息+0.7）

// 将变化应用到数据库
const profile = await updateIntimacyScore(pool, 'user_001', delta, '用户分享了暗恋秘密');
console.log(`当前亲密度: ${profile.score} (${profile.levelName})`);

// ====== 示例：根据亲密度调整Prompt ======

import { applyIntimacyToPrompt, getGreetingByIntimacy } from './intimacy';

const basePrompt = '你是曼波，一个可爱的AI助手。用萌系口癖说话，句尾加"~"或"呢"。';

// 陌生人级别
const strangerPrompt = applyIntimacyToPrompt(basePrompt, 15);
console.log(strangerPrompt);
// 会追加陌生人风格指令

// 挚友级别
const bestFriendPrompt = applyIntimacyToPrompt(basePrompt, 95);
console.log(bestFriendPrompt);
// 会追加挚友风格指令，包含撒娇、专属昵称等

// 根据亲密度打招呼
const greeting = getGreetingByIntimacy(85, '小明');
console.log(greeting);  // 可能输出: "小明~ 好想你呀！"

// ====== 示例：查看亲密度档案 ======

import { getIntimacyProfile } from './intimacy';

const profile = await getIntimacyProfile(pool, 'user_001');
console.log(`用户 ${profile.userId}:`);
console.log(`- 亲密度: ${profile.score}/100 (${profile.levelName})`);
console.log(`- 连续聊天: ${profile.streakDays}天`);
console.log(`- 总对话: ${profile.totalChats}次`);
console.log(`- 今日变化: ${profile.todayChange > 0 ? '+' : ''}${profile.todayChange}`);

// ====== 示例：亲密度排行榜 ======

import { getIntimacyLeaderboard } from './intimacy';

const leaderboard = await getIntimacyLeaderboard(pool, 5);
for (const entry of leaderboard) {
  console.log(`${entry.userId}: ${entry.score}分 (${entry.level}) - 连续${entry.streakDays}天`);
}
*/

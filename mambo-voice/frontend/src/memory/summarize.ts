/**
 * ============================================
 * summarize.ts — 记忆总结模块
 * ============================================
 * 功能：自动提取对话关键信息，生成多层级摘要
 * - 长对话自动摘要（提取关键信息，压缩冗余内容）
 * - 每日总结（生成"今日记忆"概览）
 * - 关系里程碑检测（亲密度突破阈值时自动标记）
 *
 * @module memory/summarize
 */

import { Pool } from 'pg';

// ============================================
// 类型定义
// ============================================

/** 对话消息结构 */
export interface Message {
  /** 消息角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容 */
  content: string;
  /** 消息时间戳 */
  timestamp: Date;
  /** 情绪标签 */
  emotion?: string;
}

/** 关系里程碑记录 */
export interface Milestone {
  /** 唯一ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 里程碑类型 */
  type: 'intimacy_level_up' | 'first_topic' | 'deep_talk' | 'shared_secret' | 'anniversary';
  /** 里程碑标题 */
  title: string;
  /** 详细描述 */
  description: string;
  /** 关联的记忆ID */
  relatedMemoryIds: string[];
  /** 发生时间 */
  createdAt: Date;
}

/** 亲密度等级定义 */
export interface IntimacyLevel {
  /** 等级名称 */
  name: string;
  /** 最低分数 */
  minScore: number;
  /** 最高分数 */
  maxScore: number;
  /** 等级标签 */
  label: 'stranger' | 'friend' | 'close_friend' | 'best_friend';
}

/** 摘要生成配置 */
export interface SummarizeConfig {
  /** DeepSeek API密钥 */
  deepseekApiKey: string;
  /** DeepSeek API基础URL */
  deepseekBaseUrl?: string;
  /** 使用的模型 */
  model?: string;
}

// ============================================
// 常量定义
// ============================================

/** 亲密度等级划分 */
const INTIMACY_LEVELS: IntimacyLevel[] = [
  { name: '陌生人', minScore: 0, maxScore: 30, label: 'stranger' },
  { name: '朋友', minScore: 31, maxScore: 60, label: 'friend' },
  { name: '好友', minScore: 61, maxScore: 90, label: 'close_friend' },
  { name: '挚友', minScore: 91, maxScore: 100, label: 'best_friend' },
];

/** 里程碑检测的触发条件 */
const MILESTONE_TRIGGERS = {
  /** 首次深入对话（单条消息超过100字） */
  deepTalkMinLength: 100,
  /** 首次分享秘密（关键词检测） */
  secretKeywords: ['秘密', '没告诉', '不敢说', '只跟你说', '别告诉别人', '隐私'],
  /** 连续聊天天数纪念日 */
  anniversaryDays: [7, 30, 100, 365],
};

// ============================================
// 对话摘要
// ============================================

/**
 * 对一组对话消息生成摘要
 * 使用DeepSeek API提取关键信息，将长对话压缩为精炼的摘要
 *
 * @param messages - 对话消息数组
 * @param config - API配置
 * @returns 生成的摘要文本
 */
export async function summarizeConversation(
  messages: Message[],
  config: SummarizeConfig
): Promise<string> {
  if (messages.length === 0) return '';

  // 构建对话文本（去除系统消息）
  const dialogueText = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const roleLabel = m.role === 'user' ? '用户' : '曼波';
      return `${roleLabel}：${m.content}`;
    })
    .join('\n');

  // 构建摘要Prompt
  const prompt = `请对以下对话进行摘要，提取关键信息。要求：
1. 保留用户提到的个人信息（喜好、习惯、经历等）
2. 保留重要的事件和约定
3. 用第三人称客观描述
4. 控制在100字以内

对话内容：
${dialogueText}

摘要：`;

  const summary = await callDeepSeekChat(prompt, config);

  console.log(
    `[Summarize] 对话摘要生成完成: ${messages.length}条消息 -> ${summary.length}字摘要`
  );

  return summary;
}

/**
 * 对指定用户生成每日记忆摘要
 * 汇总当天所有对话，生成"今日记忆"概览
 *
 * @param userId - 用户ID
 * @param pool - PostgreSQL连接池
 * @param config - API配置
 * @returns 今日记忆摘要文本
 */
export async function generateDailySummary(
  userId: string,
  pool: Pool,
  config: SummarizeConfig
): Promise<string> {
  // 查询今日（最近24小时）的所有记忆
  const result = await pool.query(
    `
    SELECT text, emotion, intimacy_delta, created_at
    FROM memories
    WHERE user_id = $1
      AND created_at >= NOW() - INTERVAL '1 day'
    ORDER BY created_at ASC
  `,
    [userId]
  );

  const memories = result.rows;

  if (memories.length === 0) {
    return '今天还没有和你聊天呢~';
  }

  // 构建今日对话摘要Prompt
  const memoryTexts = memories
    .map(
      (m: { text: string; emotion: string; created_at: Date }, i: number) =>
        `${i + 1}. [${m.emotion}] ${m.text}`
    )
    .join('\n');

  const totalIntimacyChange = memories.reduce(
    (sum: number, m: { intimacy_delta: number }) => sum + m.intimacy_delta,
    0
  );

  const prompt = `请根据以下今日对话记录，生成一段温馨的"今日记忆"总结。
以曼波（一个可爱的AI助手）的口吻，回顾今天的互动。
要温暖、亲切，不超过150字。

今日对话记录：
${memoryTexts}

今日亲密度变化：${totalIntimacyChange > 0 ? '+' : ''}${totalIntimacyChange}

今日记忆：`;

  const summary = await callDeepSeekChat(prompt, config);

  console.log(
    `[Summarize] 每日摘要生成完成: 用户=${userId}, ${memories.length}条记忆`
  );

  return summary;
}

// ============================================
// 里程碑检测
// ============================================

/**
 * 检测并生成用户的关系里程碑
 * 扫描用户的全部记忆，识别关键成长节点
 *
 * @param userId - 用户ID
 * @param pool - PostgreSQL连接池
 * @returns 检测到的里程碑列表
 */
export async function detectMilestones(
  userId: string,
  pool: Pool
): Promise<Milestone[]> {
  const milestones: Milestone[] = [];

  // 1. 检测亲密度等级突破
  const intimacyMilestones = await detectIntimacyMilestones(userId, pool);
  milestones.push(...intimacyMilestones);

  // 2. 检测首次深入对话
  const deepTalkMilestone = await detectDeepTalkMilestone(userId, pool);
  if (deepTalkMilestone) milestones.push(deepTalkMilestone);

  // 3. 检测首次分享秘密
  const secretMilestone = await detectSecretMilestone(userId, pool);
  if (secretMilestone) milestones.push(secretMilestone);

  // 4. 检测聊天纪念日
  const anniversaryMilestones = await detectAnniversaryMilestones(userId, pool);
  milestones.push(...anniversaryMilestones);

  // 按时间排序
  milestones.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  console.log(
    `[Summarize] 里程碑检测完成: 用户=${userId}, 发现${milestones.length}个里程碑`
  );

  return milestones;
}

/**
 * 检测亲密度等级突破里程碑
 * 当用户亲密度首次突破到新的等级时记录
 */
async function detectIntimacyMilestones(
  userId: string,
  pool: Pool
): Promise<Milestone[]> {
  const milestones: Milestone[] = [];

  // 查询亲密度的历史变化记录
  const result = await pool.query(
    `
    SELECT intimacy_score, created_at
    FROM intimacy
    WHERE user_id = $1
    ORDER BY created_at ASC
  `,
    [userId]
  );

  const history = result.rows as Array<{
    intimacy_score: number;
    created_at: Date;
  }>;

  if (history.length === 0) return milestones;

  // 追踪每个等级的首次突破
  let maxLevelIndex = -1;

  for (const record of history) {
    const score = record.intimacy_score;
    const levelIndex = INTIMACY_LEVELS.findIndex(
      (l) => score >= l.minScore && score <= l.maxScore
    );

    if (levelIndex > maxLevelIndex && levelIndex > 0) {
      // 首次突破到新等级
      const level = INTIMACY_LEVELS[levelIndex];
      maxLevelIndex = levelIndex;

      milestones.push({
        id: `milestone_intimacy_${userId}_${levelIndex}`,
        userId,
        type: 'intimacy_level_up',
        title: `成为${level.name}`,
        description: `亲密度达到${score}分，关系升级为「${level.name}」！`,
        relatedMemoryIds: [],
        createdAt: record.created_at,
      });
    }
  }

  return milestones;
}

/**
 * 检测首次深入对话里程碑
 * 当对话内容较长（超过阈值）时视为深入交流
 */
async function detectDeepTalkMilestone(
  userId: string,
  pool: Pool
): Promise<Milestone | null> {
  const result = await pool.query(
    `
    SELECT id, text, created_at
    FROM memories
    WHERE user_id = $1
      AND LENGTH(text) >= $2
    ORDER BY created_at ASC
    LIMIT 1
  `,
    [userId, MILESTONE_TRIGGERS.deepTalkMinLength]
  );

  const firstDeepTalk = result.rows[0];
  if (!firstDeepTalk) return null;

  return {
    id: `milestone_deep_talk_${userId}`,
    userId,
    type: 'deep_talk',
    title: '首次深入交流',
    description: '进行了第一次深入的对话，分享了更多想法。',
    relatedMemoryIds: [firstDeepTalk.id],
    createdAt: firstDeepTalk.created_at,
  };
}

/**
 * 检测首次分享秘密里程碑
 * 通过关键词匹配检测用户是否分享了私密信息
 */
async function detectSecretMilestone(
  userId: string,
  pool: Pool
): Promise<Milestone | null> {
  // 构建关键词匹配条件
  const keywordConditions = MILESTONE_TRIGGERS.secretKeywords
    .map((_, i) => `text LIKE $${i + 2}`)
    .join(' OR ');

  const params = [userId, ...MILESTONE_TRIGGERS.secretKeywords.map((k) => `%${k}%`)];

  const result = await pool.query(
    `
    SELECT id, text, created_at
    FROM memories
    WHERE user_id = $1
      AND (${keywordConditions})
    ORDER BY created_at ASC
    LIMIT 1
  `,
    params
  );

  const firstSecret = result.rows[0];
  if (!firstSecret) return null;

  return {
    id: `milestone_secret_${userId}`,
    userId,
    type: 'shared_secret',
    title: '首次分享秘密',
    description: '用户第一次分享了私密的心事，信任度大幅提升。',
    relatedMemoryIds: [firstSecret.id],
    createdAt: firstSecret.created_at,
  };
}

/**
 * 检测聊天纪念日里程碑
 * 连续聊天达到特定天数时触发
 */
async function detectAnniversaryMilestones(
  userId: string,
  pool: Pool
): Promise<Milestone[]> {
  const milestones: Milestone[] = [];

  // 查询用户最早的记忆时间
  const result = await pool.query(
    `
    SELECT MIN(created_at) as first_chat_date,
           COUNT(DISTINCT DATE(created_at)) as chat_days
    FROM memories
    WHERE user_id = $1
  `,
    [userId]
  );

  const { first_chat_date, chat_days } = result.rows[0] as {
    first_chat_date: Date;
    chat_days: number;
  };

  if (!first_chat_date) return milestones;

  // 检查是否达到纪念日天数
  for (const day of MILESTONE_TRIGGERS.anniversaryDays) {
    if (parseInt(chat_days, 10) >= day) {
      const anniversaryDate = new Date(first_chat_date);
      anniversaryDate.setDate(anniversaryDate.getDate() + day);

      milestones.push({
        id: `milestone_anniversary_${day}_${userId}`,
        userId,
        type: 'anniversary',
        title: `${day}天纪念`,
        description: `一起聊了${day}天，${day >= 30 ? '好棒呀！' : '加油！'}`,
        relatedMemoryIds: [],
        createdAt: anniversaryDate,
      });
    }
  }

  return milestones;
}

// ============================================
// 摘要存储与管理
// ============================================

/**
 * 将生成的摘要保存到数据库
 * 摘要作为一条特殊类型的记忆存储，方便后续检索
 *
 * @param pool - PostgreSQL连接池
 * @param userId - 用户ID
 * @param summaryText - 摘要文本
 * @param type - 摘要类型：'conversation' | 'daily'
 * @returns 存储的摘要记忆ID
 */
export async function saveSummary(
  pool: Pool,
  userId: string,
  summaryText: string,
  type: 'conversation' | 'daily' = 'conversation'
): Promise<string> {
  // 注意：摘要本身也需要embedding才能被检索
  // 这里先存储文本，embedding可以通过storeMemory补全

  const { v4: uuidv4 } = await import('uuid');
  const id = uuidv4();

  await pool.query(
    `
    INSERT INTO memories (id, user_id, text, embedding, emotion, intimacy_delta, created_at, summary)
    VALUES ($1, $2, $3, NULL, 'system', 0, NOW(), $4)
  `,
    [id, userId, `[${type === 'daily' ? '每日摘要' : '对话摘要'}] ${summaryText}`, summaryText]
  );

  console.log(`[Summarize] 摘要已保存: id=${id}, 类型=${type}`);

  return id;
}

/**
 * 获取用户最近的摘要记录
 *
 * @param pool - 数据库连接池
 * @param userId - 用户ID
 * @param limit - 返回数量
 * @returns 摘要记忆列表
 */
export async function getRecentSummaries(
  pool: Pool,
  userId: string,
  limit: number = 5
): Promise<
  Array<{
    id: string;
    text: string;
    summary: string;
    createdAt: Date;
  }>
> {
  const result = await pool.query(
    `
    SELECT id, text, summary, created_at as "createdAt"
    FROM memories
    WHERE user_id = $1
      AND summary IS NOT NULL
      AND summary != ''
    ORDER BY created_at DESC
    LIMIT $2
  `,
    [userId, limit]
  );

  return result.rows;
}

// ============================================
// 内部工具：DeepSeek API调用
// ============================================

/**
 * 调用DeepSeek Chat API生成文本
 *
 * @param prompt - 输入提示
 * @param config - API配置
 * @returns 生成的文本
 */
async function callDeepSeekChat(
  prompt: string,
  config: SummarizeConfig
): Promise<string> {
  const baseUrl = config.deepseekBaseUrl ?? 'https://api.deepseek.com';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: config.model ?? 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你是一个对话摘要助手。请客观、简洁地提取对话中的关键信息。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5, // 较低温度，更稳定的输出
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `[Summarize] DeepSeek API调用失败: ${response.status} - ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: { content: string };
      finish_reason: string;
    }>;
  };

  const content = data.choices[0]?.message?.content?.trim() ?? '';

  if (!content) {
    throw new Error('[Summarize] DeepSeek返回了空内容');
  }

  return content;
}

// ============================================
// 使用示例
// ============================================

/*
// ====== 示例：生成对话摘要 ======

import { summarizeConversation } from './summarize';

const messages: Message[] = [
  { role: 'user', content: '最近工作压力好大，每天都加班到很晚', emotion: 'tired', timestamp: new Date() },
  { role: 'assistant', content: '辛苦啦！要注意休息哦，身体最重要', emotion: 'caring', timestamp: new Date() },
  { role: 'user', content: '嗯嗯，谢谢你关心！对了，我喜欢吃川菜，辣的特别解压', emotion: 'happy', timestamp: new Date() },
  { role: 'assistant', content: '川菜真的超好吃！我知道几家很棒的川菜馆，下次推荐给你', emotion: 'excited', timestamp: new Date() },
  { role: 'user', content: '好呀好呀，周末去吃！', emotion: 'excited', timestamp: new Date() },
];

const summary = await summarizeConversation(messages, {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY!,
});
console.log('摘要:', summary);
// 可能输出: "用户最近工作压力大经常加班，喜欢吃川菜尤其是辣味，与曼波约定周末去尝试川菜馆推荐。"

// ====== 示例：生成每日摘要 ======

import { generateDailySummary } from './summarize';
import { Pool } from 'pg';

const pool = new Pool({ host: 'localhost', database: 'mambo_memory', user: 'postgres', password: 'xxx' });

const dailySummary = await generateDailySummary('user_001', pool, {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY!,
});
console.log('今日记忆:', dailySummary);
// 可能输出: "今天和主人聊了好多话题呢！早上分享了工作的小烦恼，中午讨论了最爱吃的川菜，还约好了周末一起去探店。亲密度+5，越来越亲密啦~"

// ====== 示例：检测里程碑 ======

import { detectMilestones } from './summarize';

const milestones = await detectMilestones('user_001', pool);
for (const m of milestones) {
  console.log(`[${m.type}] ${m.title}: ${m.description}`);
}
// 可能输出:
// [intimacy_level_up] 成为朋友: 亲密度达到35分，关系升级为「朋友」！
// [deep_talk] 首次深入交流: 进行了第一次深入的对话...
// [anniversary] 7天纪念: 一起聊了7天，加油！
*/

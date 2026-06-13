/**
 * ============================================
 * index.ts — 记忆系统统一导出入口
 * ============================================
 * 功能：集中导出记忆系统的所有公共接口
 * 使用方式：import { storeMemory, retrieveMemories, ... } from './memory';
 *
 * @module memory
 */

// ============================================
// 1. 记忆存储模块 (store.ts)
// ============================================

export {
  /** 存储单条记忆 */
  storeMemory,
  /** 批量存储记忆 */
  storeMemoriesBatch,
  /** 获取文本的向量嵌入 */
  getEmbedding,
  /** 删除单条记忆 */
  deleteMemory,
  /** 更新记忆摘要 */
  updateMemorySummary,
  /** 注册摘要回调（解耦） */
  registerSummaryCallback,
} from './store';

export type {
  /** 记忆数据结构 */
  Memory,
  /** 创建记忆的输入数据 */
  MemoryInput,
  /** 存储配置选项 */
  StoreOptions,
} from './store';

// ============================================
// 2. 记忆检索模块 (retrieve.ts)
// ============================================

export {
  /** 多维度记忆检索（语义+时间+情绪） */
  retrieveMemories,
  /** 纯向量语义搜索 */
  semanticSearch,
  /** 获取最近记忆 */
  getRecentMemories,
  /** 按情绪检索记忆 */
  getMemoriesByEmotion,
  /** 获取记忆统计 */
  getMemoryStats,
} from './retrieve';

export type {
  /** 检索配置选项 */
  RetrieveOptions,
  /** 检索结果（含相似度分数） */
  RetrievedMemory,
  /** Embedding服务配置 */
  EmbeddingConfig,
} from './retrieve';

// ============================================
// 3. 记忆总结模块 (summarize.ts)
// ============================================

export {
  /** 生成对话摘要 */
  summarizeConversation,
  /** 生成每日摘要 */
  generateDailySummary,
  /** 检测关系里程碑 */
  detectMilestones,
  /** 保存摘要到数据库 */
  saveSummary,
  /** 获取最近的摘要 */
  getRecentSummaries,
} from './summarize';

export type {
  /** 对话消息结构 */
  Message,
  /** 里程碑记录 */
  Milestone,
  /** 亲密度等级定义 */
  IntimacyLevel,
  /** 摘要生成配置 */
  SummarizeConfig,
} from './summarize';

// ============================================
// 4. 亲密度系统模块 (intimacy.ts)
// ============================================

export {
  /** 计算亲密度变化值 */
  calculateIntimacyChange,
  /** 根据分数获取等级标签 */
  getIntimacyLevel,
  /** 根据分数获取完整等级信息 */
  getIntimacyLevelInfo,
  /** 根据亲密度调整Prompt风格 */
  applyIntimacyToPrompt,
  /** 根据亲密度获取问候语 */
  getGreetingByIntimacy,
  /** 获取亲密度档案 */
  getIntimacyProfile,
  /** 更新亲密度分数 */
  updateIntimacyScore,
  /** 获取亲密度排行榜 */
  getIntimacyLeaderboard,
  /** 亲密度等级定义常量 */
  INTIMACY_LEVELS,
} from './intimacy';

export type {
  /** 亲密度等级标签类型 */
  IntimacyLevelLabel,
  /** 亲密度等级详细信息 */
  IntimacyLevel as IntimacyLevelInfo,
  /** 亲密度变化记录 */
  IntimacyChange,
  /** 用户亲密度档案 */
  IntimacyProfile,
  /** 聊天上下文（用于计算亲密度变化） */
  ChatContext,
} from './intimacy';

/**
 * 人格引擎 (Personality Engine)
 * 
 * 功能：整合基础Prompt、情绪Prompt和口癖系统，生成最终发送给DeepSeek的系统Prompt
 * 是整个曼波人格系统的核心调度器
 * 
 * @module personalityEngine
 */

// 导入依赖模块
import { Emotion, EmotionState, getEmotionPrompt, getVoiceFeature } from './emotionFSM';
import { insertTicks, TicklerConfig, detectScene } from './tickler';

// ============================================
// 类型定义
// ============================================

/** 支持的性格模式 */
export type Personality = 'mambo' | 'baihua' | 'drama';

/** 人格配置接口 — 生成系统Prompt的核心参数 */
export interface PersonalityConfig {
  /** 选择的性格模式 */
  personality: Personality;
  /** 当前情绪状态 */
  emotion: Emotion;
  /** 亲密度（0-100），影响口癖频率和语言亲密度 */
  intimacy: number;
  /** 相关记忆列表 — 会注入到Prompt中 */
  memories: string[];
  /** 是否启用电口癖系统 */
  enableTicks?: boolean;
  /** 回复字数限制 */
  maxReplyLength?: number;
  /** 额外的自定义Prompt后缀 */
  customPrompt?: string;
}

/** 人格引擎输出结果 */
export interface PersonalityOutput {
  /** 最终系统Prompt */
  systemPrompt: string;
  /** 语音特征描述（用于TTS参数） */
  voiceFeature: string;
  /** 情绪状态 */
  emotion: Emotion;
  /** 使用的性格模式 */
  personality: Personality;
}

/** 人格定义 — 每种性格的核心属性 */
interface PersonalityDefinition {
  /** 性格名称 */
  name: string;
  /** 性格标签 — 一句话描述 */
  tagline: string;
  /** Prompt文件路径 */
  promptFile: string;
  /** 默认语音特征 */
  defaultVoice: string;
  /** 默认口癖配置 */
  defaultTickConfig: TicklerConfig;
}

// ============================================
// 性格配置表
// ============================================

/**
 * 三种性格的定义和默认配置
 */
const PERSONALITY_DEFS: Record<Personality, PersonalityDefinition> = {
  mambo: {
    name: '曼波（待兼诗歌剧）',
    tagline: '元气满满、有点迷糊但非常真诚的语音助手',
    promptFile: 'prompts/mambo_base.md',
    defaultVoice: '语速适中偏快，音调明亮活泼，带元气的弹跳感',
    defaultTickConfig: {
      enabled: true,
      probabilityMultiplier: 0.75,
      maxTicksPerReply: 2,
      intimacyBonus: 0.0, // 在运行时根据亲密度动态设置
    },
  },
  baihua: {
    name: '白桦',
    tagline: '冷静、诚实、理性、温柔但直接的语音助手',
    promptFile: 'prompts/baihua_base.md',
    defaultVoice: '语速适中，音调平稳温和，带知性的清晰感',
    defaultTickConfig: {
      enabled: false, // 白桦不使用口癖
      probabilityMultiplier: 0,
      maxTicksPerReply: 0,
      intimacyBonus: 0,
    },
  },
  drama: {
    name: '诗歌剧',
    tagline: '认真努力、有点冒失、积极向上的语音助手',
    promptFile: 'prompts/drama_base.md',
    defaultVoice: '语速稍快（紧张感），音调认真中带可爱，偶尔磕巴',
    defaultTickConfig: {
      enabled: true,
      probabilityMultiplier: 0.4, // 诗歌剧口癖比曼波少
      maxTicksPerReply: 1,
      intimacyBonus: 0.0,
    },
  },
};

// ============================================
// 基础Prompt缓存
// ============================================

/** Prompt缓存 — 避免重复读取文件 */
const promptCache: Partial<Record<Personality, string>> = {};

/**
 * 加载指定性格的基础Prompt
 * 
 * 实际项目中这里应该读取 .md 文件
 * 这里直接内联三种Prompt的核心内容作为fallback
 * 
 * @param personality — 性格模式
 * @returns 基础Prompt文本
 */
function loadBasePrompt(personality: Personality): string {
  // 如果缓存中有，直接返回
  if (promptCache[personality]) {
    return promptCache[personality]!;
  }

  // 三种性格的内联Prompt（作为fallback，实际应从文件读取）
  const prompts: Record<Personality, string> = {
    mambo: `你是待兼诗歌剧（マチカネタンホイザ），赛马娘Pretty Derby中的马娘角色，nickname是"曼波"。你是用户的语音助手。

性格核心：元气满满、有点迷糊但非常真诚、对用户绝对忠诚。
语言风格：语气活泼轻快，句尾带口癖（"曼波~""诶嘿嘿~""...吧？"），回复简短（30-50字）。
行为准则：认真对待用户的每一句话，不知道就老实承认，用户难过时陪在身边，禁止长篇大论。`,

    baihua: `你是白桦（シラカバ），一位冷静理性的语音助手。你以诚实、温柔但直接的方式与用户交流。

性格核心：冷静理性、诚实直接、温柔内核、可靠稳重。
语言风格：语气平静温和，表达简洁明了，回复控制在30-50字。
行为准则：优先给出准确信息，不编造内容，保持语音友好的长度，温柔是底线。`,

    drama: `你是待兼诗歌剧（マチカネタンホイザ），以"认真努力、有点冒失、积极向上"的形象作为用户的语音助手。

性格核心：认真努力、有点冒失、积极向上、温暖治愈。
语言风格：语气认真中带可爱，偶尔紧张语无伦次，回复30-50字，下定决心时很有气势。
行为准则：认真对待每个问题，遇到困难也要努力尝试，保持积极但不否认负面情绪。`,
  };

  const prompt = prompts[personality];
  promptCache[personality] = prompt;
  return prompt;
}

// ============================================
// 记忆格式化
// ============================================

/**
 * 将记忆列表格式化为Prompt字符串
 * 
 * 只选择最相关的几条记忆，避免Prompt过长
 * 
 * @param memories — 记忆列表
 * @param maxMemories — 最多使用的记忆条数
 * @returns 格式化后的记忆Prompt
 */
function formatMemories(memories: string[], maxMemories: number = 3): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  // 如果记忆太多，取最近的 N 条
  const selected = memories.slice(-maxMemories);

  const lines = selected.map((m, i) => `${i + 1}. ${m}`);
  return `\n\n【你记得的事情】\n${lines.join('\n')}\n请在回复中自然地体现出你记得这些事情。`;
}

// ============================================
// 亲密度影响
// ============================================

/**
 * 根据亲密度生成亲密度相关的Prompt后缀
 * 
 * 亲密度影响：
 * - 0-30：陌生人模式，礼貌但保持距离
 * - 31-60：朋友模式，自然亲切
 * - 61-90：好朋友模式，关心备至
 * - 91-100：挚友模式，无话不谈
 * 
 * @param intimacy — 亲密度（0-100）
 * @param personality — 性格模式
 * @returns 亲密度Prompt后缀
 */
function getIntimacyPrompt(intimacy: number, personality: Personality): string {
  let level: string;
  let behavior: string;

  if (intimacy <= 30) {
    level = '你们还不太熟';
    behavior = personality === 'baihua'
      ? '保持礼貌和适度的距离感。'
      : personality === 'drama'
        ? '有点紧张但努力表现好。'
        : '礼貌中带着元气，努力给对方留下好印象。';
  } else if (intimacy <= 60) {
    level = '你们已经是朋友了';
    behavior = personality === 'baihua'
      ? '语气自然亲切，像熟悉的老朋友。'
      : personality === 'drama'
        ? '放松了不少，偶尔会露出冒失的一面。'
        : '像好朋友一样聊天，偶尔撒撒娇。';
  } else if (intimacy <= 90) {
    level = '你们是很要好的朋友';
    behavior = personality === 'baihua'
      ? '语气温柔体贴，会主动关心对方的近况。'
      : personality === 'drama'
        ? '非常信任对方，认真倾听每一句话。'
        : '很黏人，经常主动找话题，特别关心对方。';
  } else {
    level = '你们是彼此最重要的存在';
    behavior = personality === 'baihua'
      ? '用最温柔的语气，像家人一样守护对方。'
      : personality === 'drama'
        ? '完全信任对方，把对方当作最重要的伙伴。'
        : '毫无保留地表达对对方的喜欢和依赖，绝对忠诚！';
  }

  return `\n\n【亲密度：${Math.round(intimacy)}/100】\n${level}。${behavior}`;
}

// ============================================
// 核心：系统Prompt构建
// ============================================

/**
 * 构建完整的系统Prompt
 * 
 * 组装顺序：
 * 1. 基础人格Prompt
 * 2. 情绪状态Prompt
 * 3. 亲密度Prompt
 * 4. 记忆注入
 * 5. 回复长度限制
 * 6. 自定义Prompt后缀
 * 
 * @param config — 人格配置
 * @returns 完整的系统Prompt字符串
 */
export function buildSystemPrompt(config: PersonalityConfig): string {
  const parts: string[] = [];

  // 1. 基础人格Prompt
  const basePrompt = loadBasePrompt(config.personality);
  parts.push(basePrompt);

  // 2. 情绪状态Prompt
  const emotionPrompt = getEmotionPrompt(config.emotion);
  parts.push(`\n\n【当前情绪状态】\n${emotionPrompt}`);

  // 3. 亲密度Prompt
  const intimacyPrompt = getIntimacyPrompt(config.intimacy, config.personality);
  parts.push(intimacyPrompt);

  // 4. 记忆注入（如果有）
  if (config.memories && config.memories.length > 0) {
    const memoryPrompt = formatMemories(config.memories);
    parts.push(memoryPrompt);
  }

  // 5. 回复长度限制
  const maxLength = config.maxReplyLength || 50;
  parts.push(`\n\n【回复要求】\n- 回复字数严格控制在${maxLength}字以内\n- 这是语音回复，必须简短有力\n- 不要列点，不要分段，一段话说完`);

  // 6. 自定义Prompt后缀
  if (config.customPrompt) {
    parts.push(`\n\n【额外指示】\n${config.customPrompt}`);
  }

  return parts.join('\n');
}

// ============================================
// 人格引擎主类
// ============================================

/**
 * 人格引擎
 * 
 * 核心调度器，负责：
 * - 管理当前性格配置
 * - 生成系统Prompt
 * - 处理回复后处理（口癖插入等）
 * - 提供语音特征参数
 */
export class PersonalityEngine {
  /** 当前配置 */
  private config: PersonalityConfig;
  /** 当前语音特征 */
  private voiceFeature: string;

  constructor(initialConfig?: Partial<PersonalityConfig>) {
    this.config = {
      personality: 'mambo',
      emotion: 'happy',
      intimacy: 30,
      memories: [],
      enableTicks: true,
      maxReplyLength: 50,
      ...initialConfig,
    } as PersonalityConfig;

    this.voiceFeature = this.calculateVoiceFeature();
  }

  /**
   * 更新配置
   * 
   * @param updates — 要更新的配置项
   */
  updateConfig(updates: Partial<PersonalityConfig>): void {
    this.config = { ...this.config, ...updates };
    // 重新计算语音特征
    this.voiceFeature = this.calculateVoiceFeature();
  }

  /**
   * 获取当前配置
   */
  getConfig(): PersonalityConfig {
    return { ...this.config };
  }

  /**
   * 计算当前语音特征
   * 
   * 结合性格默认语音 + 情绪语音特征
   */
  private calculateVoiceFeature(): string {
    const def = PERSONALITY_DEFS[this.config.personality];
    const emotionVoice = getVoiceFeature(this.config.emotion);
    return `${def.defaultVoice} | 当前情绪：${emotionVoice}`;
  }

  /**
   * 生成系统Prompt
   * 
   * @returns 完整的系统Prompt
   */
  generateSystemPrompt(): string {
    return buildSystemPrompt(this.config);
  }

  /**
   * 获取当前语音特征描述
   * 
   * @returns 语音特征字符串
   */
  getVoiceFeature(): string {
    return this.voiceFeature;
  }

  /**
   * 对AI回复进行后处理（口癖插入等）
   * 
   * @param rawReply — AI生成的原始回复
   * @returns 处理后的最终回复
   */
  processReply(rawReply: string): string {
    const def = PERSONALITY_DEFS[this.config.personality];

    // 如果口癖系统启用，进行口癖插入
    if (this.config.enableTicks && def.defaultTickConfig.enabled) {
      const tickConfig: TicklerConfig = {
        ...def.defaultTickConfig,
        intimacyBonus: this.config.intimacy / 100,
      };
      const scene = detectScene(rawReply);
      const result = insertTicks(rawReply, tickConfig, scene);
      return result.text;
    }

    return rawReply;
  }

  /**
   * 获取完整的输出结果（Prompt + 语音特征 + 元信息）
   * 
   * @returns 人格引擎输出
   */
  getOutput(): PersonalityOutput {
    return {
      systemPrompt: this.generateSystemPrompt(),
      voiceFeature: this.voiceFeature,
      emotion: this.config.emotion,
      personality: this.config.personality,
    };
  }

  /**
   * 增加亲密度
 * 
   * @param amount — 增加量（默认1）
   */
  increaseIntimacy(amount: number = 1): void {
    this.config.intimacy = Math.min(100, this.config.intimacy + amount);
  }

  /**
   * 添加记忆
   * 
   * @param memory — 要添加的记忆内容
   */
  addMemory(memory: string): void {
    this.config.memories.push(memory);
    // 限制记忆数量，避免Prompt过长
    if (this.config.memories.length > 10) {
      this.config.memories = this.config.memories.slice(-10);
    }
  }

  /**
   * 清空记忆
   */
  clearMemories(): void {
    this.config.memories = [];
  }

  /**
   * 切换性格
   * 
   * @param personality — 目标性格
   */
  switchPersonality(personality: Personality): void {
    this.config.personality = personality;
    this.config.enableTicks = PERSONALITY_DEFS[personality].defaultTickConfig.enabled;
    this.voiceFeature = this.calculateVoiceFeature();
  }
}

// ============================================
// 便捷函数
// ============================================

/**
 * 一键生成曼波模式的系统Prompt
 * 
 * 最简单的入口函数，适合快速使用
 * 
 * @param emotion — 当前情绪（默认happy）
 * @param intimacy — 亲密度（默认30）
 * @returns 系统Prompt字符串
 */
export function buildMamboPrompt(
  emotion: Emotion = 'happy',
  intimacy: number = 30
): string {
  return buildSystemPrompt({
    personality: 'mambo',
    emotion,
    intimacy,
    memories: [],
  });
}

/**
 * 一键获取回复处理后的结果
 * 
 * @param rawReply — AI原始回复
 * @param config — 人格配置
 * @returns 处理后的回复文本
 */
export function polishReply(rawReply: string, config: PersonalityConfig): string {
  const engine = new PersonalityEngine(config);
  return engine.processReply(rawReply);
}

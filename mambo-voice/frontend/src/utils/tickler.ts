/**
 * 口癖插入系统 (Verbal Tickler)
 * 
 * 功能：根据场景自动在回复中插入口癖，让曼波的语言更加自然生动
 * 设计思路：基于场景分类 + 随机概率控制，避免每句都带口癖导致生硬
 * 
 * @module tickler
 */

// ============================================
// 类型定义
// ============================================

/** 场景类型 — 决定使用哪种口癖 */
export type Scene = 'greeting' | 'question' | 'mistake' | 'encourage' | 'farewell' | 'normal';

/** 口癖位置 — 口癖可以出现在句子的不同位置 */
export type TickPosition = 'prefix' | 'suffix' | 'interjection';

/** 口癖条目 — 单个口癖的完整定义 */
export interface TickEntry {
  /** 口癖文本内容 */
  text: string;
  /** 适用的场景列表 */
  scenes: Scene[];
  /** 口癖出现的位置 */
  position: TickPosition;
  /** 基础出现概率（0.0 ~ 1.0），值越大越容易出现 */
  baseProbability: number;
}

/** 口癖配置 — 控制插入行为的参数 */
export interface TicklerConfig {
  /** 全局口癖启用开关 */
  enabled: boolean;
  /** 全局概率乘数 — 用于调节整体口癖频率 */
  probabilityMultiplier: number;
  /** 同一回复中最多插入几个口癖 */
  maxTicksPerReply: number;
  /** 亲密度加成 — 亲密度越高，口癖越自然 */
  intimacyBonus: number;
}

// ============================================
// 口癖词典
// ============================================

/**
 * 曼波口癖词典
 * 
 * 设计原则：
 * - 每个口癖都有适用场景，不会在不合适的场合出现
 * - 基础概率控制在 0.2~0.6 之间，避免过于频繁
 * - 位置分布合理：前缀用于打招呼，后缀用于句尾语气，插入语用于中间
 */
const TICKS: TickEntry[] = [
  // --- 开头口癖（prefix）---
  {
    text: '曼波~',
    scenes: ['greeting', 'normal', 'encourage'],
    position: 'prefix',
    baseProbability: 0.35,
  },
  {
    text: '诶嘿嘿~',
    scenes: ['greeting', 'normal', 'encourage'],
    position: 'prefix',
    baseProbability: 0.25,
  },
  {
    text: '那个...',
    scenes: ['question', 'mistake', 'normal'],
    position: 'prefix',
    baseProbability: 0.20,
  },
  {
    text: '啊！',
    scenes: ['mistake', 'question'],
    position: 'prefix',
    baseProbability: 0.30,
  },

  // --- 疑问口癖（suffix）---
  {
    text: '...吧？',
    scenes: ['question', 'normal'],
    position: 'suffix',
    baseProbability: 0.40,
  },
  {
    text: '是吗？',
    scenes: ['question', 'normal'],
    position: 'suffix',
    baseProbability: 0.25,
  },
  {
    text: '对吧！',
    scenes: ['encourage', 'normal'],
    position: 'suffix',
    baseProbability: 0.20,
  },
  {
    text: '...对吧？',
    scenes: ['question'],
    position: 'suffix',
    baseProbability: 0.30,
  },
  {
    text: '...吗？',
    scenes: ['question'],
    position: 'suffix',
    baseProbability: 0.25,
  },

  // --- 承认错误口癖（interjection / prefix）---
  {
    text: '对不起啦...',
    scenes: ['mistake'],
    position: 'prefix',
    baseProbability: 0.55,
  },
  {
    text: '啊，搞错了...',
    scenes: ['mistake'],
    position: 'interjection',
    baseProbability: 0.45,
  },
  {
    text: '呜...抱歉...',
    scenes: ['mistake'],
    position: 'prefix',
    baseProbability: 0.30,
  },

  // --- 鼓励口癖 ---
  {
    text: '没问题的！',
    scenes: ['encourage', 'normal'],
    position: 'interjection',
    baseProbability: 0.45,
  },
  {
    text: '加油加油~',
    scenes: ['encourage', 'greeting'],
    position: 'interjection',
    baseProbability: 0.35,
  },
  {
    text: '你一定可以的！',
    scenes: ['encourage'],
    position: 'suffix',
    baseProbability: 0.30,
  },
  {
    text: '打起精神来！',
    scenes: ['encourage'],
    position: 'interjection',
    baseProbability: 0.25,
  },

  // --- 告别口癖 ---
  {
    text: '下次见啦~',
    scenes: ['farewell'],
    position: 'suffix',
    baseProbability: 0.55,
  },
  {
    text: '拜拜~曼波~',
    scenes: ['farewell'],
    position: 'suffix',
    baseProbability: 0.40,
  },
  {
    text: '好好休息哦~',
    scenes: ['farewell'],
    position: 'suffix',
    baseProbability: 0.30,
  },

  // --- 害羞口癖 ---
  {
    text: '诶嘿嘿...被夸了~',
    scenes: ['normal'],
    position: 'interjection',
    baseProbability: 0.20,
  },
  {
    text: '没有啦...',
    scenes: ['normal'],
    position: 'prefix',
    baseProbability: 0.15,
  },

  // --- 通用填充口癖 ---
  {
    text: '嘿嘿~',
    scenes: ['greeting', 'encourage', 'normal'],
    position: 'interjection',
    baseProbability: 0.20,
  },
  {
    text: '嗯...',
    scenes: ['question', 'normal'],
    position: 'prefix',
    baseProbability: 0.15,
  },
  {
    text: '哎呀~',
    scenes: ['mistake', 'normal'],
    position: 'interjection',
    baseProbability: 0.20,
  },
];

// ============================================
// 场景识别函数
// ============================================

/**
 * 场景关键词词典 — 用于自动识别对话场景
 */
const SCENE_KEYWORDS: Record<Scene, string[]> = {
  greeting: ['你好', '早上好', '晚上好', '嗨', 'hello', 'hi', '在吗', '在不在'],
  question: [
    '为什么', '怎么', '什么', '多少', '哪里', '谁', '吗', '？', '?',
    '请问', '能不能', '可以吗', '怎么办', '如何', '怎样'
  ],
  mistake: ['错了', '不对', '搞错了', '笨', '傻', '不是这样的', '你错了', '不对吧'],
  encourage: ['加油', '努力', '可以的', '别放弃', '坚持', '相信自己', '你行'],
  farewell: ['再见', '拜拜', 'bye', '晚安', '走了', '下次见', '回头见'],
  normal: [], // normal 是默认场景，不需要关键词
};

/**
 * 识别用户输入对应的场景
 * 
 * @param input — 用户输入文本
 * @returns 识别出的场景类型
 */
export function detectScene(input: string): Scene {
  const lowerInput = input.toLowerCase();

  // 按优先级检查各场景的关键词
  const scenePriority: Scene[] = ['greeting', 'farewell', 'mistake', 'encourage', 'question'];

  for (const scene of scenePriority) {
    const keywords = SCENE_KEYWORDS[scene];
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        return scene;
      }
    }
  }

  // 没有匹配到特定场景，返回 normal
  return 'normal';
}

// ============================================
// 核心口癖插入逻辑
// ============================================

/**
 * 计算口癖的最终出现概率
 * 
 * 概率公式：最终概率 = 基础概率 × 全局乘数 × 亲密度加成
 * 
 * @param tick — 口癖条目
 * @param config — 口癖配置
 * @returns 最终概率值（0.0 ~ 1.0）
 */
function calculateFinalProbability(
  tick: TickEntry,
  config: TicklerConfig
): number {
  let probability = tick.baseProbability;

  // 应用全局概率乘数
  probability *= config.probabilityMultiplier;

  // 应用亲密度加成（亲密度越高，口癖越自然，概率略微提升）
  probability *= (1 + config.intimacyBonus * 0.3);

  // 确保概率在合理范围内
  return Math.min(1.0, Math.max(0.0, probability));
}

/**
 * 口癖插入结果
 */
export interface TickResult {
  /** 插入口癖后的最终文本 */
  text: string;
  /** 实际插入的口癖列表 */
  insertedTicks: Array<{ text: string; position: TickPosition }>;
  /** 使用的场景类型 */
  scene: Scene;
}

/**
 * 为回复文本插入口癖
 * 
 * 算法步骤：
 * 1. 识别当前对话场景
 * 2. 筛选出适合该场景的口癖
 * 3. 对每个口癖进行概率判定（随机数 < 概率则插入）
 4. 控制最多插入数量，避免过度
 * 5. 按位置将口癖拼接到原文中
 * 
 * @param originalText — AI生成的原始回复文本
 * @param config — 口癖配置
 * @param forceScene — 强制指定场景（可选，默认自动检测）
 * @returns 口癖插入结果
 */
export function insertTicks(
  originalText: string,
  config: TicklerConfig,
  forceScene?: Scene
): TickResult {
  // 如果口癖系统被禁用，直接返回原文
  if (!config.enabled) {
    return {
      text: originalText,
      insertedTicks: [],
      scene: forceScene || 'normal',
    };
  }

  // 1. 识别场景
  const scene = forceScene || detectScene(originalText);

  // 2. 筛选适用该场景的口癖，并按位置分组
  const suitableTicks = TICKS.filter((tick) => tick.scenes.includes(scene));

  // 3. 对候选口癖进行概率筛选
  const candidates: Array<{ entry: TickEntry; roll: number; finalProb: number }> = [];
  for (const tick of suitableTicks) {
    const finalProb = calculateFinalProbability(tick, config);
    const roll = Math.random();
    if (roll < finalProb) {
      candidates.push({ entry: tick, roll, finalProb });
    }
  }

  // 4. 如果候选太多，按概率排序取前 N 个
  if (candidates.length > config.maxTicksPerReply) {
    candidates.sort((a, b) => b.finalProb - a.finalProb);
  }
  const selected = candidates.slice(0, config.maxTicksPerReply);

  // 5. 按位置分类
  const prefixTicks = selected
    .filter((c) => c.entry.position === 'prefix')
    .map((c) => c.entry);
  const interjectionTicks = selected
    .filter((c) => c.entry.position === 'interjection')
    .map((c) => c.entry);
  const suffixTicks = selected
    .filter((c) => c.entry.position === 'suffix')
    .map((c) => c.entry);

  // 6. 构建最终文本
  let result = originalText;
  const inserted: Array<{ text: string; position: TickPosition }> = [];

  // 前缀口癖：加在句首
  if (prefixTicks.length > 0) {
    const prefix = prefixTicks.map((t) => t.text).join('');
    result = prefix + result;
    prefixTicks.forEach((t) => inserted.push({ text: t.text, position: 'prefix' }));
  }

  // 插入语口癖：随机插在句子中间或句末
  if (interjectionTicks.length > 0) {
    const interjection = interjectionTicks.map((t) => t.text).join('');
    // 简单策略：如果有逗号/句号，插在第一个标点之后；否则插在中间
    const firstPunct = result.search(/[，。！？,.!?]/);
    if (firstPunct !== -1 && firstPunct < result.length - 1) {
      result = result.slice(0, firstPunct + 1) + interjection + result.slice(firstPunct + 1);
    } else {
      const mid = Math.floor(result.length / 2);
      result = result.slice(0, mid) + interjection + result.slice(mid);
    }
    interjectionTicks.forEach((t) => inserted.push({ text: t.text, position: 'interjection' }));
  }

  // 后缀口癖：加在句尾
  if (suffixTicks.length > 0) {
    const suffix = suffixTicks.map((t) => t.text).join('');
    // 去掉原文末尾的标点（如果有），再加上后缀和自己的标点
    result = result.replace(/[。.!！?？\s]+$/, '') + suffix;
    suffixTicks.forEach((t) => inserted.push({ text: t.text, position: 'suffix' }));
  }

  return {
    text: result,
    insertedTicks: inserted,
    scene,
  };
}

// ============================================
// 快捷函数
// ============================================

/**
 * 使用曼波默认配置的快捷插入函数
 * 
 * @param text — 原始回复文本
 * @param intimacy — 当前亲密度（0-100）
 * @returns 插入后的文本
 */
export function tickle(text: string, intimacy: number = 50): string {
  const config: TicklerConfig = {
    enabled: true,
    probabilityMultiplier: 0.7,       // 曼波的默认口癖频率：适中
    maxTicksPerReply: 2,              // 每条回复最多2个口癖
    intimacyBonus: intimacy / 100,    // 亲密度越高越自然
  };

  const result = insertTicks(text, config);
  return result.text;
}

/**
 * 使用指定场景的快捷插入函数
 * 
 * @param text — 原始回复文本
 * @param scene — 强制指定的场景
 * @param intimacy — 当前亲密度（0-100）
 * @returns 插入后的文本
 */
export function tickleWithScene(
  text: string,
  scene: Scene,
  intimacy: number = 50
): string {
  const config: TicklerConfig = {
    enabled: true,
    probabilityMultiplier: 0.7,
    maxTicksPerReply: 2,
    intimacyBonus: intimacy / 100,
  };

  const result = insertTicks(text, config, scene);
  return result.text;
}

/**
 * 获取所有可用的口癖列表（用于调试和配置界面展示）
 * 
 * @returns 口癖条目数组
 */
export function getAllTicks(): TickEntry[] {
  return [...TICKS];
}

/**
 * 获取指定场景的口癖列表
 * 
 * @param scene — 场景类型
 * @returns 适用于该场景的口癖列表
 */
export function getTicksByScene(scene: Scene): TickEntry[] {
  return TICKS.filter((tick) => tick.scenes.includes(scene));
}

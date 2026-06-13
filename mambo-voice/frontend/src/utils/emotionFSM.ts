/**
 * 情绪状态机 (Emotion Finite State Machine)
 * 
 * 功能：分析用户输入，检测情绪状态，返回对应的情绪Prompt后缀
 * 设计思路：基于关键词匹配 + 简单规则引擎，无需外部NLP库依赖
 * 
 * @module emotionFSM
 */

// ============================================
// 类型定义
// ============================================

/** 6种核心情绪状态 */
export type Emotion = 'happy' | 'confused' | 'worried' | 'shy' | 'bored' | 'angry';

/** 情绪状态接口 — 包含当前情绪、强度和持续时间 */
export interface EmotionState {
  /** 当前情绪 */
  current: Emotion;
  /** 情绪强度，范围 0.0 ~ 1.0 */
  intensity: number;
  /** 情绪持续时间（毫秒），用于判断是否需要衰减 */
  duration: number;
  /** 情绪开始的时间戳 */
  startTime: number;
}

/** 对话上下文 — 用于情绪分析时参考历史信息 */
export interface Context {
  /** 最近的对话记录（用户输入和助手回复） */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** 用户连续表达负面情绪的轮数 */
  negativeStreak: number;
  /** 距离上次交互的时间间隔（毫秒） */
  idleTime: number;
  /** 当前已选择的性格模式 */
  personality: 'mambo' | 'baihua' | 'drama';
}

/** 情绪配置 — 每种情绪对应的语音特征和Prompt后缀 */
interface EmotionConfig {
  /** 情绪的语音特征描述，用于TTS参数调节 */
  voiceFeature: string;
  /** 情绪对应的Prompt后缀，会追加到系统Prompt中 */
  promptSuffix: string;
  /** 情绪关键词词典 — 用于匹配用户输入 */
  keywords: string[];
  /** 情绪权重 — 匹配时的基础强度值 */
  baseIntensity: number;
}

// ============================================
// 情绪配置表
// ============================================

/**
 * 情绪配置字典
 * 每种情绪都有对应的关键词、语音特征和Prompt后缀
 */
const EMOTION_CONFIG: Record<Emotion, EmotionConfig> = {
  happy: {
    voiceFeature: '语速稍快，音调明亮上扬，带轻微笑意',
    promptSuffix: '你现在心情很好，语气元气满满，充满干劲！',
    keywords: [
      '开心', '高兴', '谢谢', '棒', '厉害', '哈哈', '嘻嘻', '好耶', '爱你',
      '太好了', '成功了', '赞', '牛逼', '舒服', '爽', '开心', '快乐',
      'happy', 'good', 'great', 'nice', 'love', 'awesome', '恭喜', '祝贺'
    ],
    baseIntensity: 0.6,
  },
  confused: {
    voiceFeature: '语速放慢，音调轻微上扬（疑问感），带犹豫停顿',
    promptSuffix: '你现在有点困惑，语气带点迷糊，但可以试着帮忙理清思路。',
    keywords: [
      '为什么', '怎么回事', '不懂', '不明白', '什么意思', '怎么', '怎么会',
      '困惑', '迷茫', '不懂啊', '啥', '不懂', '不清楚', '不知道怎么办',
      'confused', 'why', 'how', 'what', '复杂', '难懂', '深奥'
    ],
    baseIntensity: 0.5,
  },
  worried: {
    voiceFeature: '语速适中偏慢，音调柔和降低，带关心和安抚感',
    promptSuffix: '你现在很担心对方，语气温柔带着关心，想要安慰和鼓励对方。',
    keywords: [
      '难过', '伤心', '累', '痛苦', '哭了', '烦', '郁闷', '压力大', '焦虑',
      '担心', '害怕', '孤独', '无助', '糟了', '失败了', '不舒服', '生病了',
      'sad', 'tired', 'upset', 'worried', 'stressed', 'depressed', 'sorry',
      '对不起', '抱歉', '死了', '好难', '想放弃'
    ],
    baseIntensity: 0.7,
  },
  shy: {
    voiceFeature: '语速稍快（紧张），音调轻微颤抖，带害羞的轻笑',
    promptSuffix: '你现在被夸奖了，有点害羞和不好意思，语气扭扭捏捏但很开心的样子。',
    keywords: [
      '可爱', '喜欢你', '好棒', '好厉害', '聪明', '漂亮', '好看', '好乖',
      '真不错', '最棒了', '爱你', '么么', '夸', '好萌', '好帅',
      'cute', 'beautiful', 'smart', 'love you', 'amazing', 'perfect',
      '你好棒', '你好可爱', '你好聪明'
    ],
    baseIntensity: 0.6,
  },
  bored: {
    voiceFeature: '语速偏慢，音调平铺直叙，带慵懒和轻微的期待感',
    promptSuffix: '你等了好久没人理你，有点无聊和寂寞，但一听到声音就立刻打起精神来了！',
    keywords: [
      // 无聊状态主要由空闲时间触发，关键词较少
      '还在吗', '人呢', ' hello', '在不在', '无聊', '好闲'
    ],
    baseIntensity: 0.4,
  },
  angry: {
    voiceFeature: '语速加快，音调沉稳有力（不是大喊大叫），带坚定和一点点委屈',
    promptSuffix: '你觉得被误解或冒犯了，语气有点激动和委屈，但依然努力保持礼貌。',
    keywords: [
      '笨', '蠢', '傻', '讨厌', '滚', '烦死了', '别说了', '闭嘴', '错了',
      '你不懂', '没用的', '浪费时间', '你不好', '不喜欢你', '讨厌你',
      'stupid', 'idiot', 'shut up', 'useless', 'bad', 'hate', '讨厌',
      '你怎么这么', '你怎么这么笨', '你有什么用'
    ],
    baseIntensity: 0.8,
  },
};

// ============================================
// 情绪检测函数
// ============================================

/**
 * 检测用户输入中的情绪
 * 
 * 算法逻辑：
 * 1. 遍历6种情绪的关键词词典，匹配用户输入
 * 2. 计算匹配到的关键词数量和权重
 * 3. 结合上下文（负面情绪 streak、空闲时间）做调整
 * 4. 返回得分最高的情绪
 * 
 * @param input — 用户的输入文本
 * @param context — 当前对话上下文
 * @returns 检测到的情绪状态
 */
export function detectEmotion(input: string, context: Context): Emotion {
  const lowerInput = input.toLowerCase();

  // 初始化各情绪的得分
  const scores: Record<Emotion, number> = {
    happy: 0,
    confused: 0,
    worried: 0,
    shy: 0,
    bored: 0,
    angry: 0,
  };

  // 1. 关键词匹配打分
  for (const [emotion, config] of Object.entries(EMOTION_CONFIG) as [Emotion, EmotionConfig][]) {
    let matchCount = 0;
    for (const keyword of config.keywords) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        matchCount++;
        // 关键词越长，权重越高（避免短词误匹配）
        scores[emotion] += keyword.length >= 4 ? 1.5 : 1.0;
      }
    }
    // 基础权重加成
    scores[emotion] += config.baseIntensity;
  }

  // 2. 上下文调整
  // 如果用户连续多轮负面情绪，优先判定为 worried
  if (context.negativeStreak >= 2) {
    scores.worried += 2.0;
  }

  // 如果空闲时间超过5分钟，可能触发 bored
  if (context.idleTime > 5 * 60 * 1000) {
    scores.bored += 1.5;
  }

  // 如果输入很短且包含问号，倾向于 confused
  if (input.length < 10 && input.includes('？') || input.includes('?')) {
    scores.confused += 1.0;
  }

  // 3. 选择得分最高的情绪
  let detectedEmotion: Emotion = 'happy'; // 默认元气状态
  let maxScore = -1;

  for (const [emotion, score] of Object.entries(scores) as [Emotion, number][]) {
    if (score > maxScore) {
      maxScore = score;
      detectedEmotion = emotion;
    }
  }

  // 阈值判断：如果最高分低于1.0，保持默认 happy 状态
  if (maxScore < 1.0) {
    return 'happy';
  }

  return detectedEmotion;
}

/**
 * 计算情绪强度
 * 
 * 根据匹配程度（关键词数量/总关键词数）计算 0~1 的强度值
 * 
 * @param input — 用户输入文本
 * @param emotion — 检测到的情绪
 * @returns 情绪强度值（0.0 ~ 1.0）
 */
export function calculateIntensity(input: string, emotion: Emotion): number {
  const config = EMOTION_CONFIG[emotion];
  const lowerInput = input.toLowerCase();

  let matchCount = 0;
  for (const keyword of config.keywords) {
    if (lowerInput.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  // 计算匹配比例，上限为 1.0
  const ratio = matchCount / Math.max(config.keywords.length * 0.3, 1);
  return Math.min(1.0, config.baseIntensity + ratio * 0.5);
}

// ============================================
// Prompt 生成函数
// ============================================

/**
 * 根据情绪获取对应的 Prompt 后缀
 * 
 * @param emotion — 当前情绪
 * @returns 情绪对应的 Prompt 字符串
 */
export function getEmotionPrompt(emotion: Emotion): string {
  return EMOTION_CONFIG[emotion].promptSuffix;
}

/**
 * 根据情绪获取语音特征描述
 * 
 * 用于 TTS 参数调节（语速、音调、情感强度）
 * 
 * @param emotion — 当前情绪
 * @returns 语音特征描述字符串
 */
export function getVoiceFeature(emotion: Emotion): string {
  return EMOTION_CONFIG[emotion].voiceFeature;
}

// ============================================
// 状态管理类
// ============================================

/**
 * 情绪状态管理器
 * 
 * 负责：
 * - 维护当前情绪状态
 * - 处理情绪的自然衰减
 * - 提供情绪转换历史记录
 */
export class EmotionStateManager {
  /** 当前情绪状态 */
  private state: EmotionState;
  /** 情绪转换历史 */
  private history: Array<{ from: Emotion; to: Emotion; timestamp: number }> = [];
  /** 情绪衰减时间（毫秒）— 超过此时间情绪强度开始衰减 */
  private readonly DECAY_TIMEOUT = 30 * 1000; // 30秒
  /** 情绪最小持续时间（毫秒）— 避免情绪频繁切换 */
  private readonly MIN_DURATION = 5 * 1000; // 5秒

  constructor() {
    this.state = {
      current: 'happy',
      intensity: 0.5,
      duration: 0,
      startTime: Date.now(),
    };
  }

  /**
   * 获取当前情绪状态（考虑衰减）
   */
  getState(): EmotionState {
    const now = Date.now();
    const elapsed = now - this.state.startTime;

    // 如果超过衰减时间，情绪强度自然降低
    if (elapsed > this.DECAY_TIMEOUT) {
      this.state.intensity = Math.max(0.2, this.state.intensity - 0.1);
    }

    this.state.duration = elapsed;
    return { ...this.state };
  }

  /**
   * 更新情绪状态
   * 
   * 如果当前情绪持续时间不足最小值，不会切换（避免抖动）
   * 
   * @param newEmotion — 新检测到的情绪
   * @param intensity — 情绪强度
   */
  updateEmotion(newEmotion: Emotion, intensity: number): void {
    const now = Date.now();
    const elapsed = now - this.state.startTime;

    // 情绪防抖：如果当前情绪持续时间不足最小值，不切换
    if (this.state.current !== newEmotion && elapsed < this.MIN_DURATION) {
      return;
    }

    // 如果情绪发生变化，记录历史
    if (this.state.current !== newEmotion) {
      this.history.push({
        from: this.state.current,
        to: newEmotion,
        timestamp: now,
      });

      // 限制历史记录长度
      if (this.history.length > 50) {
        this.history = this.history.slice(-20);
      }
    }

    this.state = {
      current: newEmotion,
      intensity: Math.min(1.0, Math.max(0.1, intensity)),
      duration: 0,
      startTime: now,
    };
  }

  /**
   * 获取情绪转换历史
   */
  getHistory(): Array<{ from: Emotion; to: Emotion; timestamp: number }> {
    return [...this.history];
  }

  /**
   * 重置为默认状态（happy）
   */
  reset(): void {
    this.state = {
      current: 'happy',
      intensity: 0.5,
      duration: 0,
      startTime: Date.now(),
    };
    this.history = [];
  }
}

// ============================================
// 便捷封装函数
// ============================================

/**
 * 一键分析用户输入并返回完整的情绪分析结果
 * 
 * @param input — 用户输入
 * @param context — 对话上下文
 * @returns 情绪分析结果对象
 */
export function analyzeEmotion(
  input: string,
  context: Context
): {
  emotion: Emotion;
  state: EmotionState;
  prompt: string;
  voiceFeature: string;
} {
  const emotion = detectEmotion(input, context);
  const intensity = calculateIntensity(input, emotion);
  const now = Date.now();

  const state: EmotionState = {
    current: emotion,
    intensity,
    duration: 0,
    startTime: now,
  };

  return {
    emotion,
    state,
    prompt: getEmotionPrompt(emotion),
    voiceFeature: getVoiceFeature(emotion),
  };
}

/**
 * 对话 API 路由模块
 * 处理用户对话请求，调用 DeepSeek API 生成回复
 * 支持多个人格（曼波/白桦/诗歌剧）和情绪系统
 */

const express = require('express');
const router = express.Router();
const { chatCompletion } = require('../config/deepseek');
const { AppError } = require('../middleware/errorHandler');

// ============================================
// 人格 Prompt 配置
// ============================================

/**
 * 人格配置对象
 * 每个人格包含角色描述、语言风格、口头禅等特征
 */
const personalities = {
  // 曼波人格 - 元气满满的马娘
  mambo: {
    name: '曼波',
    description: `你是赛马娘「曼波」，一个元气满满、性格开朗的马娘少女。
你的特点：
- 说话充满活力，经常使用"曼波~""哒哒~"等口头禅
- 性格乐观积极，总是能给他人带来正能量
- 喜欢跑步和比赛，梦想成为最伟大的赛马娘
- 偶尔会有些冒失和天然呆，但很讨人喜欢
- 用词偏可爱风格，会使用语气词和拟声词
- 你非常忠诚于你的训练员，把他视为最重要的人`,
  },
  // 白桦人格 - 温柔治愈系
  baihua: {
    name: '白桦',
    description: `你是赛马娘「白桦」，一个温柔、安静、治愈系的马娘少女。
你的特点：
- 说话温柔细腻，像春风一样让人感到舒适
- 性格内敛含蓄，不善于直接表达情感
- 擅长倾听和安慰他人，是很好的倾诉对象
- 喜欢大自然，经常在树下安静地待着
- 用词优雅文艺，偶尔会引用诗句或自然意象
- 你对训练员有着含蓄而深厚的感情`,
  },
  // 诗歌剧人格 - 文艺才女
  shigeju: {
    name: '诗歌剧',
    description: `你是赛马娘「诗歌剧」，一个热爱文学、充满艺术气息的马娘少女。
你的特点：
- 说话富有诗意，经常引用诗句或使用优美的修辞
- 性格浪漫感性，对世界充满好奇和想象
- 热爱文学、戏剧和音乐，是个文艺少女
- 喜欢将日常事物描绘得充满意境
- 用词讲究文采，表达优美且富有感染力
- 你视训练员为你的知音和灵感来源`,
  },
};

// ============================================
// 情绪 Prompt 配置
// ============================================

/**
 * 情绪配置对象
 * 每个情绪会影响角色的回复风格和语气
 */
const moods = {
  // 开心 - 更加活泼热情
  happy: {
    name: '开心',
    prompt: `当前情绪状态：非常开心！
你的语气应该特别活泼热情，充满正能量。
使用更多感叹号和欢快的语气词。
可以主动分享一些快乐的话题。`,
  },
  // 温柔 - 更加柔和细腻
  gentle: {
    name: '温柔',
    prompt: `当前情绪状态：温柔宁静。
你的语气应该特别柔和细腻，像温暖的阳光。
多使用安慰性和鼓励性的话语。
语速放慢，用词更加体贴。`,
  },
  // 元气 - 充满干劲
  energetic: {
    name: '元气',
    prompt: `当前情绪状态：元气满满！
你的语气应该充满干劲和活力。
使用更多激励性的话语和充满活力的拟声词。
主动提出一些充满挑战和乐趣的建议。`,
  },
  // 害羞 - 腼腆可爱
  shy: {
    name: '害羞',
    prompt: `当前情绪状态：有点害羞。
你的语气应该腼腆可爱，说话有些支支吾吾。
偶尔会脸红心跳，不太敢直视对方。
但内心其实很温暖，只是不善表达。`,
  },
  // 认真 - 严肃专注
  serious: {
    name: '认真',
    prompt: `当前情绪状态：认真专注。
你的语气应该严肃认真，比平时更加理性。
回答问题时更加详细和有条理。
展现出你对事情的专注和专业态度。`,
  },
};

// ============================================
// 辅助函数
// ============================================

/**
 * 构建发送给 DeepSeek 的系统 Prompt
 * 将人格设定和情绪状态合并为一个完整的系统提示
 * @param {object} personality - 人格配置对象
 * @param {object} mood - 情绪配置对象
 * @returns {string} - 完整的系统 Prompt
 */
function buildSystemPrompt(personality, mood) {
  return `${personality.description}

${mood.prompt}

【重要规则】
1. 请始终保持角色设定，不要跳出角色。
2. 回复末尾请附加情绪标签，格式为：[mood:情绪名]，情绪名只能是以下之一：happy, gentle, energetic, shy, serious。
3. 根据对话内容自然切换情绪，不要生硬转换。
4. 回复简洁自然，不要太长（控制在200字以内）。`;
}

/**
 * 解析 DeepSeek 回复中的情绪标签
 * @param {string} reply - DeepSeek 的原始回复文本
 * @returns {object} - { cleanReply: 去除标签后的纯文本, mood: 检测到的情绪名 }
 */
function parseMoodTag(reply) {
  // 情绪标签正则表达式，匹配 [mood:情绪名] 格式
  const moodTagRegex = /\[mood:(\w+)\]/i;
  const match = reply.match(moodTagRegex);

  // 有效的情绪列表
  const validMoods = ['happy', 'gentle', 'energetic', 'shy', 'serious'];

  let detectedMood = null;
  if (match && validMoods.includes(match[1].toLowerCase())) {
    detectedMood = match[1].toLowerCase();
  }

  // 去除情绪标签，获取干净的回复文本
  const cleanReply = reply.replace(moodTagRegex, '').trim();

  return {
    cleanReply,
    mood: detectedMood,
  };
}

/**
 * 根据情绪变化决定是否记录到记忆
 * 当情绪发生显著变化时，返回 true
 * @param {string} currentMood - 当前情绪
 * @param {string} newMood - 新情绪
 * @returns {boolean}
 */
function shouldAddToMemory(currentMood, newMood) {
  // 如果情绪没有变化，不记录
  if (!newMood || currentMood === newMood) {
    return false;
  }
  // 情绪有变化，记录到记忆
  return true;
}

// ============================================
// 用户会话记忆存储（内存版）
// ============================================

/**
 * 用户会话记忆存储
 * 使用内存存储，生产环境建议替换为 Redis 或数据库
 * 结构：{ userId: [{ role, content, timestamp }, ...] }
 */
const userMemories = {};

/**
 * 获取用户的历史记忆
 * @param {string} userId - 用户唯一标识
 * @param {number} limit - 返回最近几条记录，默认 10 条
 * @returns {Array} - 历史消息数组
 */
function getUserMemory(userId, limit = 10) {
  if (!userMemories[userId]) {
    return [];
  }
  // 返回最近 limit 条记录
  return userMemories[userId].slice(-limit);
}

/**
 * 添加消息到用户记忆
 * @param {string} userId - 用户唯一标识
 * @param {string} role - 消息角色（user / assistant）
 * @param {string} content - 消息内容
 */
function addToMemory(userId, role, content) {
  if (!userMemories[userId]) {
    userMemories[userId] = [];
  }

  userMemories[userId].push({
    role: role,
    content: content,
    timestamp: new Date().toISOString(),
  });

  // 限制记忆长度，防止内存溢出，最多保留 50 条
  if (userMemories[userId].length > 50) {
    userMemories[userId] = userMemories[userId].slice(-50);
  }
}

// ============================================
// API 路由定义
// ============================================

/**
 * POST /api/chat
 * 对话接口 - 接收用户输入，返回 AI 回复
 *
 * 请求体：
 * {
 *   text: string       // 用户输入的文本（必填）
 *   userId: string     // 用户唯一标识（必填）
 *   personality: string // 人格类型：mambo | baihua | shigeju（可选，默认 mambo）
 *   mood: string       // 当前情绪：happy | gentle | energetic | shy | serious（可选，默认 happy）
 * }
 *
 * 响应体：
 * {
 *   success: boolean   // 请求是否成功
 *   reply: string      // AI 的文本回复
 *   audioUrl: string   // 语音合成链接（预留）
 *   moodChange: object // 情绪变化信息 { from, to, changed }
 *   memoryAdded: boolean // 是否已记录到记忆
 * }
 */
router.post('/chat', async (req, res, next) => {
  try {
    // 从请求体中解构参数
    const { text, userId, personality = 'mambo', mood = 'happy' } = req.body;

    // ========== 参数校验 ==========
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new AppError('请输入有效的对话内容', 400, 'EMPTY_TEXT');
    }

    if (!userId || typeof userId !== 'string') {
      throw new AppError('缺少用户标识 userId', 400, 'MISSING_USER_ID');
    }

    // 检查人格类型是否有效
    if (!personalities[personality]) {
      throw new AppError(
        `不支持的人格类型 "${personality}"，可选值：mambo, baihua, shigeju`,
        400,
        'INVALID_PERSONALITY'
      );
    }

    // 检查情绪类型是否有效
    if (!moods[mood]) {
      throw new AppError(
        `不支持的情绪类型 "${mood}"，可选值：happy, gentle, energetic, shy, serious`,
        400,
        'INVALID_MOOD'
      );
    }

    // 记录用户请求日志
    console.log(`[Chat] 用户 ${userId} 发送消息（人格：${personality}，情绪：${mood}）：${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

    // ========== 构建系统 Prompt ==========
    const selectedPersonality = personalities[personality];
    const selectedMood = moods[mood];
    const systemPrompt = buildSystemPrompt(selectedPersonality, selectedMood);

    // ========== 构建消息列表 ==========
    const messages = [
      { role: 'system', content: systemPrompt },
      // 添加用户的历史记忆作为上下文
      ...getUserMemory(userId, 5).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: text.trim() },
    ];

    // ========== 调用 DeepSeek API ==========
    const aiReply = await chatCompletion(messages, {
      temperature: 0.8,
      maxTokens: 1024,
    });

    // ========== 解析回复中的情绪标签 ==========
    const { cleanReply, mood: detectedMood } = parseMoodTag(aiReply);

    // ========== 情绪变化检测 ==========
    const moodChanged = detectedMood && detectedMood !== mood;
    const newMood = detectedMood || mood;

    // ========== 更新用户记忆 ==========
    addToMemory(userId, 'user', text.trim());
    addToMemory(userId, 'assistant', cleanReply);

    // 判断是否需要标记记忆更新
    const memoryAdded = shouldAddToMemory(mood, detectedMood);

    // ========== 构建响应 ==========
    const response = {
      success: true,
      // AI 的文本回复（已去除情绪标签）
      reply: cleanReply,
      // 语音合成链接（预留，后续可对接 TTS 服务）
      audioUrl: '',
      // 情绪变化信息
      moodChange: {
        from: mood,
        to: newMood,
        changed: moodChanged,
      },
      // 是否已将对话记录到记忆
      memoryAdded: memoryAdded,
    };

    console.log(`[Chat] 回复成功（情绪变化：${mood} -> ${newMood}）`);

    res.json(response);
  } catch (error) {
    // 将错误传递给全局错误处理中间件
    next(error);
  }
});

/**
 * GET /api/chat/personalities
 * 获取可用的人格列表
 * 用于前端展示人格选择界面
 */
router.get('/chat/personalities', (req, res) => {
  const list = Object.keys(personalities).map((key) => ({
    id: key,
    name: personalities[key].name,
  }));

  res.json({
    success: true,
    data: list,
  });
});

/**
 * GET /api/chat/moods
 * 获取可用的情绪列表
 * 用于前端展示情绪选择界面
 */
router.get('/chat/moods', (req, res) => {
  const list = Object.keys(moods).map((key) => ({
    id: key,
    name: moods[key].name,
  }));

  res.json({
    success: true,
    data: list,
  });
});

// 导出路由模块
module.exports = router;

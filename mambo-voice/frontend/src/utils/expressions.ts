/**
 * ============================================================
 * 曼波语音助手 - 表情控制系统
 * ============================================================
 * 负责管理6种情绪对应的面部参数，支持表情混合过渡
 * 所有参数范围在 [-1, 1] 或 [0, 1] 之间，便于插值计算
 */

import { ExpressionParams, Mood } from '../types';

/** 每种情绪对应的表情参数表 */
const MOOD_EXPRESSION_MAP: Record<Mood, ExpressionParams> = {
  // 开心：眉毛上扬、眼睛张大、嘴巴大笑、暖色腮红
  happy: {
    eyebrowLeft: 0.6,
    eyebrowRight: 0.6,
    eyeOpenLeft: 1.0,
    eyeOpenRight: 1.0,
    mouthOpen: 0.5,
    mouthSmile: 1.0,
    cheekColor: [1.0, 0.6, 0.6], // 粉红色
  },

  // 困惑：眉毛一高一低（歪头感）、眼睛微眯、嘴巴微张
  confused: {
    eyebrowLeft: 0.8,
    eyebrowRight: -0.3,
    eyeOpenLeft: 0.7,
    eyeOpenRight: 0.7,
    mouthOpen: 0.2,
    mouthSmile: -0.2,
    cheekColor: [0.8, 0.7, 0.6], // 淡褐色
  },

  // 担心：眉毛下垂呈八字、眼睛半睁、嘴巴紧闭
  worried: {
    eyebrowLeft: -0.6,
    eyebrowRight: -0.6,
    eyeOpenLeft: 0.6,
    eyeOpenRight: 0.6,
    mouthOpen: 0.0,
    mouthSmile: -0.4,
    cheekColor: [0.5, 0.7, 0.9], // 淡蓝色
  },

  // 害羞：眉毛微抬、眼睛半闭（羞涩）、嘴巴微笑、明显腮红
  shy: {
    eyebrowLeft: 0.3,
    eyebrowRight: 0.3,
    eyeOpenLeft: 0.4,
    eyeOpenRight: 0.4,
    mouthOpen: 0.0,
    mouthSmile: 0.6,
    cheekColor: [1.0, 0.4, 0.4], // 深粉红色
  },

  // 无聊：眉毛平直、眼睛半睁（ sleepy 感）、嘴巴平线
  bored: {
    eyebrowLeft: 0.0,
    eyebrowRight: 0.0,
    eyeOpenLeft: 0.35,
    eyeOpenRight: 0.35,
    mouthOpen: 0.0,
    mouthSmile: 0.0,
    cheekColor: [0.6, 0.6, 0.65], // 灰紫色
  },

  // 生气：眉毛倒竖、眼睛张大瞪视、嘴巴紧闭下撇、偏红脸颊
  angry: {
    eyebrowLeft: -0.8,
    eyebrowRight: -0.8,
    eyeOpenLeft: 0.9,
    eyeOpenRight: 0.9,
    mouthOpen: 0.0,
    mouthSmile: -0.7,
    cheekColor: [0.9, 0.3, 0.3], // 红色
  },
};

/**
 * 根据情绪获取对应的表情参数
 * @param mood - 情绪类型
 * @returns 对应的表情参数对象
 */
export function getExpressionByMood(mood: string): ExpressionParams {
  const key = mood as Mood;
  return MOOD_EXPRESSION_MAP[key] ?? MOOD_EXPRESSION_MAP.happy;
}

/**
 * 线性插值辅助函数
 * @param a - 起始值
 * @param b - 目标值
 * @param t - 插值系数 (0-1)
 * @returns 插值结果
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 在两个表情之间进行平滑过渡（混合）
 * 使用 ease-in-out 曲线让过渡更自然
 * @param from - 起始表情
 * @param to - 目标表情
 * @param t - 过渡进度 (0=完全起始, 1=完全目标)
 * @returns 过渡中的表情参数
 */
export function blendExpressions(
  from: ExpressionParams,
  to: ExpressionParams,
  t: number
): ExpressionParams {
  // 使用 smoothstep 缓动函数使过渡更平滑
  const smoothT = t * t * (3 - 2 * t);

  return {
    eyebrowLeft: lerp(from.eyebrowLeft, to.eyebrowLeft, smoothT),
    eyebrowRight: lerp(from.eyebrowRight, to.eyebrowRight, smoothT),
    eyeOpenLeft: lerp(from.eyeOpenLeft, to.eyeOpenLeft, smoothT),
    eyeOpenRight: lerp(from.eyeOpenRight, to.eyeOpenRight, smoothT),
    mouthOpen: lerp(from.mouthOpen, to.mouthOpen, smoothT),
    mouthSmile: lerp(from.mouthSmile, to.mouthSmile, smoothT),
    cheekColor: [
      lerp(from.cheekColor[0], to.cheekColor[0], smoothT),
      lerp(from.cheekColor[1], to.cheekColor[1], smoothT),
      lerp(from.cheekColor[2], to.cheekColor[2], smoothT),
    ] as [number, number, number],
  };
}

/**
 * 根据语音状态获取嘴型开合度
 * 用于说话时嘴巴的开合动画
 * @param voiceState - 语音状态
 * @param time - 当前时间（毫秒），用于周期性嘴型变化
 * @returns 嘴巴开合度 (0-1)
 */
export function getMouthOpenByVoiceState(
  voiceState: string,
  time: number = 0
): number {
  switch (voiceState) {
    case 'speaking':
      // 说话时嘴巴周期性开合，模拟发音
      return 0.3 + 0.4 * Math.abs(Math.sin(time * 0.008));
    case 'listening':
      // 倾听时嘴巴微张，表示专注
      return 0.15;
    case 'idle':
    default:
      // 空闲时嘴巴闭合
      return 0.0;
  }
}

/**
 * 根据语音状态获取眼睛开合度的额外偏移
 * 不同状态下眼神会有细微变化
 * @param voiceState - 语音状态
 * @returns 眼睛开合度偏移量
 */
export function getEyeOpenOffsetByVoiceState(voiceState: string): number {
  switch (voiceState) {
    case 'speaking':
      // 说话时眼睛更有神
      return 0.1;
    case 'listening':
      // 倾听时眼睛微微张大表示专注
      return 0.15;
    case 'idle':
    default:
      return 0;
  }
}

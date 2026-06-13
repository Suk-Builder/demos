/**
 * ============================================================
 * 曼波语音助手 - 动画控制系统
 * ============================================================
 * 使用数学函数驱动程序化动画，无需外部动画文件
 * 支持 idle/listening/speaking 三种状态的骨骼级动画
 */

import { AnimationConfig, Mood, VoiceState } from '../types';

/** 动画骨骼变换数据 - 每一帧的骨骼旋转/位移 */
export interface BoneTransform {
  /** 骨骼名称 */
  boneName: string;
  /** 旋转角度（欧拉角，弧度） */
  rotation: [number, number, number];
  /** 位移偏移 */
  position: [number, number, number];
}

/** 动画帧数据 */
export interface AnimationFrame {
  /** 时间戳（毫秒） */
  time: number;
  /** 该帧的所有骨骼变换 */
  transforms: BoneTransform[];
}

/** 动画剪辑 */
export interface AnimationClip {
  /** 动画名称 */
  name: string;
  /** 动画时长（毫秒） */
  duration: number;
  /** 是否循环 */
  loop: boolean;
  /** 采样函数：给定时间返回当前帧 */
  sample: (time: number) => BoneTransform[];
}

/** 缓动函数集合 */
const Easing = {
  /** 正弦缓入缓出 - 最平滑 */
  sineInOut: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,
  /** 二次缓出 - 快速启动 */
  quadOut: (t: number): number => 1 - (1 - t) * (1 - t),
  /** 弹跳缓动 - 活泼感 */
  bounce: (t: number): number => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) {
      const t2 = t - 1.5 / 2.75;
      return 7.5625 * t2 * t2 + 0.75;
    }
    if (t < 2.5 / 2.75) {
      const t2 = t - 2.25 / 2.75;
      return 7.5625 * t2 * t2 + 0.9375;
    }
    const t2 = t - 2.625 / 2.75;
    return 7.5625 * t2 * t2 + 0.984375;
  },
};

/**
 * 生成呼吸动画数据
 * 使用正弦波模拟自然呼吸节奏
 * @param time - 当前时间（毫秒）
 * @param intensity - 呼吸强度 (0-1)
 * @returns 胸部骨骼的旋转变换
 */
function getBreathingAnimation(
  time: number,
  intensity: number = 1
): BoneTransform {
  const breathCycle = Math.sin(time * 0.002); // 约3秒一个呼吸周期
  const breathAmount = breathCycle * 0.05 * intensity;

  return {
    boneName: 'chest',
    rotation: [breathAmount, 0, 0],
    position: [0, breathAmount * 0.3, 0],
  };
}

/**
 * 生成身体轻微摇摆动画
 * 模拟站立时的自然重心移动
 * @param time - 当前时间（毫秒）
 * @param intensity - 摇摆强度 (0-1)
 * @returns 身体骨骼的变换
 */
function getSwayAnimation(
  time: number,
  intensity: number = 1
): BoneTransform {
  const swayX = Math.sin(time * 0.0015) * 0.03 * intensity;
  const swayZ = Math.cos(time * 0.0012) * 0.02 * intensity;

  return {
    boneName: 'body',
    rotation: [swayX, 0, swayZ],
    position: [swayZ * 0.5, 0, 0],
  };
}

/**
 * 生成眨眼动画
 * 随机间隔眨眼，模拟真实行为
 * @param time - 当前时间（毫秒）
 * @returns 眼睛开合度 (0=闭合, 1=睁开)
 */
export function getBlinkValue(time: number): number {
  // 每3-5秒眨眼一次，每次眨眼持续150ms
  const blinkInterval = 3500;
  const blinkDuration = 150;
  const cycleTime = time % blinkInterval;

  if (cycleTime < blinkDuration) {
    // 眨眼过程中：快速闭合再睁开
    const blinkProgress = cycleTime / blinkDuration;
    // 抛物线形状：1 -> 0 -> 1
    return 1 - Math.sin(blinkProgress * Math.PI);
  }
  return 1; // 眼睛睁开
}

/**
 * 生成 Idle 状态动画
 * 包含：呼吸 + 轻微摇摆 + 偶尔歪头
 * @param config - 动画配置
 * @param time - 当前时间
 * @returns 当前帧的所有骨骼变换
 */
export function getIdleAnimation(
  config: AnimationConfig,
  time: number
): BoneTransform[] {
  const { mood, intensity } = config;
  const transforms: BoneTransform[] = [];
  const moodMultiplier = getMoodIntensityMultiplier(mood);
  const finalIntensity = intensity * moodMultiplier;

  // 基础呼吸动画
  transforms.push(getBreathingAnimation(time, finalIntensity));

  // 身体摇摆
  transforms.push(getSwayAnimation(time, finalIntensity * 0.5));

  // 根据情绪添加特色动作
  switch (mood) {
    case 'happy': {
      // 开心时轻微上下浮动（雀跃感）
      const bounce = Math.abs(Math.sin(time * 0.003)) * 0.08 * finalIntensity;
      transforms.push({
        boneName: 'body',
        rotation: [0, 0, 0],
        position: [0, bounce, 0],
      });
      break;
    }
    case 'bored': {
      // 无聊时身体微微前倾，更有"懒散"感
      const slouch = Math.sin(time * 0.001) * 0.03 * finalIntensity;
      transforms.push({
        boneName: 'body',
        rotation: [0.05 + slouch, 0, 0],
        position: [0, -0.02, 0.02],
      });
      break;
    }
    case 'shy': {
      // 害羞时身体微微左右摇摆（扭捏）
      const shySway = Math.sin(time * 0.002) * 0.04 * finalIntensity;
      transforms.push({
        boneName: 'body',
        rotation: [0, 0, shySway],
        position: [shySway * 0.3, 0, 0],
      });
      break;
    }
    case 'angry': {
      // 生气时身体微微颤动
      const shake = (Math.random() - 0.5) * 0.02 * finalIntensity;
      transforms.push({
        boneName: 'body',
        rotation: [shake, shake * 0.5, 0],
        position: [0, 0, 0],
      });
      break;
    }
    case 'confused': {
      // 困惑时头部周期性歪向一边
      const tilt = Math.sin(time * 0.0018) * 0.12 * finalIntensity;
      transforms.push({
        boneName: 'head',
        rotation: [0, 0, tilt],
        position: [0, 0, 0],
      });
      break;
    }
    case 'worried': {
      // 担心时双手在身前搓动
      const wring = Math.sin(time * 0.004) * 0.1 * finalIntensity;
      transforms.push({
        boneName: 'leftArm',
        rotation: [0, 0, -0.2 + wring],
        position: [0.1, 0, 0.05],
      });
      transforms.push({
        boneName: 'rightArm',
        rotation: [0, 0, 0.2 - wring],
        position: [-0.1, 0, 0.05],
      });
      break;
    }
    default:
      break;
  }

  // 头部微小随机转动（让角色更有生气）
  const headYaw = Math.sin(time * 0.0008) * 0.05 * finalIntensity;
  const headPitch = Math.cos(time * 0.0006) * 0.03 * finalIntensity;
  transforms.push({
    boneName: 'head',
    rotation: [headPitch, headYaw, 0],
    position: [0, 0, 0],
  });

  return transforms;
}

/**
 * 生成 Listening 状态动画
 * 身体前倾、专注姿态
 * @param config - 动画配置
 * @param time - 当前时间
 * @returns 当前帧的骨骼变换
 */
export function getListeningAnimation(
  config: AnimationConfig,
  time: number
): BoneTransform[] {
  const { mood, intensity } = config;
  const transforms: BoneTransform[] = [];

  // 前倾姿态（表示专注倾听）
  const leanAmount = 0.12 * intensity;
  transforms.push({
    boneName: 'body',
    rotation: [leanAmount, 0, 0],
    position: [0, 0, 0.05 * intensity],
  });

  // 轻微呼吸（比平时更浅更快）
  const fastBreath = Math.sin(time * 0.003) * 0.03 * intensity;
  transforms.push({
    boneName: 'chest',
    rotation: [fastBreath, 0, 0],
    position: [0, fastBreath * 0.2, 0],
  });

  // 头部微微前伸（"凑近听"的感觉）
  const headLean = 0.08 * intensity;
  transforms.push({
    boneName: 'head',
    rotation: [headLean, 0, 0],
    position: [0, 0, 0.02 * intensity],
  });

  // 根据情绪的倾听差异
  switch (mood) {
    case 'happy': {
      // 开心倾听时轻微点头
      const nod = Math.abs(Math.sin(time * 0.004)) * 0.06 * intensity;
      transforms.push({
        boneName: 'head',
        rotation: [headLean + nod, 0, 0],
        position: [0, 0, 0],
      });
      break;
    }
    case 'confused': {
      // 困惑倾听时歪头
      const tilt = 0.15 * intensity;
      transforms.push({
        boneName: 'head',
        rotation: [headLean, 0, tilt],
        position: [0, 0, 0],
      });
      break;
    }
    case 'worried': {
      // 担心时双手微微抬起
      transforms.push({
        boneName: 'leftArm',
        rotation: [0.3 * intensity, 0, -0.1],
        position: [0, 0, 0],
      });
      transforms.push({
        boneName: 'rightArm',
        rotation: [0.3 * intensity, 0, 0.1],
        position: [0, 0, 0],
      });
      break;
    }
    default:
      break;
  }

  return transforms;
}

/**
 * 生成 Speaking 状态动画
 * 嘴巴开合、手势配合、身体微动
 * @param config - 动画配置
 * @param time - 当前时间
 * @returns 当前帧的骨骼变换
 */
export function getSpeakingAnimation(
  config: AnimationConfig,
  time: number
): BoneTransform[] {
  const { mood, intensity } = config;
  const transforms: BoneTransform[] = [];

  // 说话时身体轻微上下律动
  const speechBounce = Math.sin(time * 0.005) * 0.03 * intensity;
  transforms.push({
    boneName: 'body',
    rotation: [0, 0, 0],
    position: [0, speechBounce, 0],
  });

  // 呼吸配合说话
  const speechBreath = Math.sin(time * 0.004) * 0.04 * intensity;
  transforms.push({
    boneName: 'chest',
    rotation: [speechBreath, 0, 0],
    position: [0, speechBreath * 0.3, 0],
  });

  // 根据情绪的手势差异
  switch (mood) {
    case 'happy': {
      // 开心说话时双手欢快摆动
      const handWave = Math.sin(time * 0.006) * 0.3 * intensity;
      transforms.push({
        boneName: 'leftArm',
        rotation: [0, 0, -0.4 + handWave],
        position: [0, 0.05, 0],
      });
      transforms.push({
        boneName: 'rightArm',
        rotation: [0, 0, 0.4 - handWave],
        position: [0, 0.05, 0],
      });
      break;
    }
    case 'angry': {
      // 生气说话时双手握拳、动作有力
      const emphatic = Math.sin(time * 0.008) * 0.15 * intensity;
      transforms.push({
        boneName: 'leftArm',
        rotation: [0.2 + emphatic, 0, -0.3],
        position: [0, 0, 0],
      });
      transforms.push({
        boneName: 'rightArm',
        rotation: [0.2 - emphatic, 0, 0.3],
        position: [0, 0, 0],
      });
      break;
    }
    case 'shy': {
      // 害羞说话时手指在胸前互戳
      const fidget = Math.sin(time * 0.005) * 0.08 * intensity;
      transforms.push({
        boneName: 'leftArm',
        rotation: [0.5, 0, -0.15 + fidget],
        position: [0.08, 0, 0.05],
      });
      transforms.push({
        boneName: 'rightArm',
        rotation: [0.5, 0, 0.15 - fidget],
        position: [-0.08, 0, 0.05],
      });
      break;
    }
    default: {
      // 默认说话时自然手势
      const gesture = Math.sin(time * 0.003) * 0.15 * intensity;
      transforms.push({
        boneName: 'leftArm',
        rotation: [0, 0, -0.2 + gesture],
        position: [0, 0, 0],
      });
      transforms.push({
        boneName: 'rightArm',
        rotation: [0, 0, 0.2 + gesture * 0.5],
        position: [0, 0, 0],
      });
    }
  }

  // 头部微微晃动（强调语气感）
  const headNod = Math.sin(time * 0.005) * 0.04 * intensity;
  transforms.push({
    boneName: 'head',
    rotation: [headNod, 0, 0],
    position: [0, 0, 0],
  });

  return transforms;
}

/**
 * 获取情绪强度乘数
 * 不同情绪对动画强度的影响系数
 * @param mood - 情绪类型
 * @returns 强度乘数 (0.5-1.5)
 */
function getMoodIntensityMultiplier(mood: string): number {
  switch (mood) {
    case 'happy':
      return 1.2; // 开心更活泼
    case 'angry':
      return 1.3; // 生气更有力
    case 'bored':
      return 0.4; // 无聊更慵懒
    case 'shy':
      return 0.7; // 害羞更含蓄
    case 'worried':
      return 0.9; // 担心更收敛
    case 'confused':
      return 0.8; // 困惑更缓慢
    default:
      return 1.0;
  }
}

/**
 * 状态切换时的平滑过渡
 * 使用 ease-in-out 曲线在两种动画状态间混合
 * @param fromTransforms - 起始状态的骨骼变换
 * @param toTransforms - 目标状态的骨骼变换
 * @param transitionProgress - 过渡进度 (0-1)
 * @returns 混合后的骨骼变换
 */
export function blendAnimations(
  fromTransforms: BoneTransform[],
  toTransforms: BoneTransform[],
  transitionProgress: number
): BoneTransform[] {
  const smoothT = Easing.sineInOut(transitionProgress);
  const result: BoneTransform[] = [];

  // 合并所有骨骼名称
  const allBones = new Set([
    ...fromTransforms.map((t) => t.boneName),
    ...toTransforms.map((t) => t.boneName),
  ]);

  allBones.forEach((boneName) => {
    const from = fromTransforms.find((t) => t.boneName === boneName);
    const to = toTransforms.find((t) => t.boneName === boneName);

    if (from && to) {
      result.push({
        boneName,
        rotation: [
          from.rotation[0] + (to.rotation[0] - from.rotation[0]) * smoothT,
          from.rotation[1] + (to.rotation[1] - from.rotation[1]) * smoothT,
          from.rotation[2] + (to.rotation[2] - from.rotation[2]) * smoothT,
        ],
        position: [
          from.position[0] + (to.position[0] - from.position[0]) * smoothT,
          from.position[1] + (to.position[1] - from.position[1]) * smoothT,
          from.position[2] + (to.position[2] - from.position[2]) * smoothT,
        ],
      });
    } else if (to) {
      // 只有目标状态有这个骨骼
      result.push({
        boneName,
        rotation: [
          to.rotation[0] * smoothT,
          to.rotation[1] * smoothT,
          to.rotation[2] * smoothT,
        ],
        position: [
          to.position[0] * smoothT,
          to.position[1] * smoothT,
          to.position[2] * smoothT,
        ],
      });
    } else if (from) {
      // 只有起始状态有这个骨骼
      result.push({
        boneName,
        rotation: [
          from.rotation[0] * (1 - smoothT),
          from.rotation[1] * (1 - smoothT),
          from.rotation[2] * (1 - smoothT),
        ],
        position: [
          from.position[0] * (1 - smoothT),
          from.position[1] * (1 - smoothT),
          from.position[2] * (1 - smoothT),
        ],
      });
    }
  });

  return result;
}

/**
 * 根据当前配置获取对应的动画数据
 * 综合状态选择正确的动画函数
 * @param config - 动画配置
 * @param time - 当前时间
 * @returns 当前帧的骨骼变换
 */
export function getAnimationByState(
  config: AnimationConfig,
  time: number
): BoneTransform[] {
  const { voiceState } = config;

  switch (voiceState) {
    case 'speaking':
      return getSpeakingAnimation(config, time);
    case 'listening':
      return getListeningAnimation(config, time);
    case 'idle':
    default:
      return getIdleAnimation(config, time);
  }
}

/**
 * 生成主界面展示的待机动画（非角色动画，用于UI元素）
 * 漂浮、呼吸效果等
 * @param time - 当前时间
 * @returns 浮动偏移量 [x, y, z]
 */
export function getFloatingOffset(time: number): [number, number, number] {
  return [
    Math.sin(time * 0.001) * 0.02,
    Math.sin(time * 0.002) * 0.03,
    Math.cos(time * 0.0015) * 0.01,
  ];
}

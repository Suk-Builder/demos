/**
 * ============================================================
 * 曼波语音助手 - 类型定义
 * ============================================================
 * 所有类型定义集中管理，供各模块使用
 */

/** 情绪状态枚举 - 定义曼波可以表达的情绪 */
export type Mood = 'happy' | 'confused' | 'worried' | 'shy' | 'bored' | 'angry';

/** 语音状态枚举 - 定义曼波的交互状态 */
export type VoiceState = 'idle' | 'listening' | 'speaking';

/** 表情参数接口 - 控制面部各部位的变形程度 */
export interface ExpressionParams {
  /** 左眉毛高度 (-1=下垂, 0=正常, 1=上扬) */
  eyebrowLeft: number;
  /** 右眉毛高度 (-1=下垂, 0=正常, 1=上扬) */
  eyebrowRight: number;
  /** 左眼开合度 (0=闭合, 1=全开) */
  eyeOpenLeft: number;
  /** 右眼开合度 (0=闭合, 1=全开) */
  eyeOpenRight: number;
  /** 嘴巴开合度 (0=闭合, 1=大张) */
  mouthOpen: number;
  /** 嘴巴微笑度 (-1=下撇, 0=正常, 1=大笑) */
  mouthSmile: number;
  /** 脸颊颜色 RGB */
  cheekColor: [number, number, number];
}

/** 动画配置接口 */
export interface AnimationConfig {
  /** 当前情绪 */
  mood: Mood;
  /** 当前语音状态 */
  voiceState: VoiceState;
  /** 动画强度 (0-1) */
  intensity: number;
}



/** 情绪状态接口 - 包含当前情绪和强度等信息 */
export interface EmotionState {
  /** 当前情绪 */
  current: Mood;
  /** 情绪强度 (0-1) */
  intensity: number;
  /** 上一个情绪 */
  previous?: Mood;
  /** 情绪持续时间（毫秒） */
  duration?: number;
}

/** Mambo3D 组件属性接口 */
export interface Mambo3DProps {
  /** 当前情绪状态 */
  mood: 'happy' | 'confused' | 'worried' | 'shy' | 'bored' | 'angry';
  /** 当前语音交互状态 */
  voiceState: 'idle' | 'listening' | 'speaking';
  /** 点击回调函数 */
  onClick?: () => void;
}

/** Scene3D 组件属性接口 */
export interface Scene3DProps {
  /** 当前情绪状态 */
  mood?: string;
  /** 当前语音交互状态 */
  voiceState?: string;
  /** 子元素 - 接受 React 渲染内容 */
  children?: import('react').ReactNode;
}

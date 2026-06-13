/**
 * MoodIndicator.tsx - 情绪指示器组件
 *
 * 根据曼波当前情绪状态显示对应的表情图标和颜色：
 * - happy: 😊 黄色（开心）
 * - confused: 😕 灰色（困惑）
 * - worried: 😟 蓝色（担心）
 * - shy: 😳 粉色（害羞）
 * - bored: 😴 灰色（无聊）
 * - angry: 😠 红色（生气）
 *
 * 位置在顶部标题栏右侧，32px圆形图标
 */

import React from "react";
import type { Emotion } from "../utils/emotionFSM";
export type { Emotion };

/** 情绪数据配置 - 每个情绪对应的图标、颜色、描述 */
const EMOTION_CONFIG: Record<
  Emotion,
  {
    icon: string;       // 表情符号
    bgColor: string;    // 背景色（Tailwind类）
    glowColor: string;  // 发光色（Tailwind shadow类）
    label: string;      // 中文描述
    description: string; // 状态描述
  }
> = {
  happy: {
    icon: "😊",
    bgColor: "bg-amber-400",
    glowColor: "shadow-[0_0_12px_rgba(251,191,36,0.6)]",
    label: "开心",
    description: "曼波很开心~",
  },
  confused: {
    icon: "😕",
    bgColor: "bg-gray-400",
    glowColor: "shadow-[0_0_12px_rgba(156,163,175,0.5)]",
    label: "困惑",
    description: "曼波有点困惑...",
  },
  worried: {
    icon: "😟",
    bgColor: "bg-blue-400",
    glowColor: "shadow-[0_0_12px_rgba(96,165,250,0.5)]",
    label: "担心",
    description: "曼波有点担心...",
  },
  shy: {
    icon: "😳",
    bgColor: "bg-pink-400",
    glowColor: "shadow-[0_0_12px_rgba(249,168,212,0.5)]",
    label: "害羞",
    description: "曼波害羞了///",
  },
  bored: {
    icon: "😴",
    bgColor: "bg-gray-500",
    glowColor: "shadow-[0_0_12px_rgba(107,114,128,0.5)]",
    label: "无聊",
    description: "曼波有点无聊...",
  },
  angry: {
    icon: "😠",
    bgColor: "bg-red-400",
    glowColor: "shadow-[0_0_12px_rgba(248,113,113,0.6)]",
    label: "生气",
    description: "曼波生气了！",
  },
};

/** 情绪指示器组件属性 */
export interface MoodIndicatorProps {
  /** 当前情绪 */
  mood: Emotion;
  /** 是否显示情绪标签文字 */
  showLabel?: boolean;
  /** 是否显示弹跳动画 */
  animate?: boolean;
  /** 点击回调 */
  onClick?: (mood: Emotion) => void;
}

/**
 * 情绪指示器组件
 *
 * @param mood - 当前情绪状态
 * @param showLabel - 是否显示情绪文字标签
 * @param animate - 是否播放弹跳动画
 * @param onClick - 点击事件回调
 */
const MoodIndicator: React.FC<MoodIndicatorProps> = ({
  mood,
  showLabel = false,
  animate = false,
  onClick,
}) => {
  // 获取当前情绪的配置数据
  const config = EMOTION_CONFIG[mood] || EMOTION_CONFIG.happy;

  /**
   * 处理点击事件
   */
  const handleClick = () => {
    if (onClick) {
      onClick(mood);
    }
  };

  return (
    <div
      className={`
        flex items-center gap-2 
        ${onClick ? "cursor-pointer" : "cursor-default"}
      `}
      onClick={handleClick}
      role="img"
      aria-label={`曼波当前情绪：${config.label}`}
    >
      {/* 情绪图标圆形 */}
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center
          ${config.bgColor} ${config.glowColor}
          text-lg leading-none
          transition-all duration-300 ease-out
          hover:scale-110 hover:brightness-110
          ${animate ? "animate-mood-bounce" : ""}
        `}
      >
        {config.icon}
      </div>

      {/* 情绪标签（可选） */}
      {showLabel && (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-white/80">
            {config.label}
          </span>
          <span className="text-[10px] text-white/40">{config.description}</span>
        </div>
      )}
    </div>
  );
};

export default MoodIndicator;

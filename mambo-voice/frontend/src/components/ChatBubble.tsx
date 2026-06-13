/**
 * ChatBubble.tsx - 对话气泡组件
 *
 * 显示单条对话消息的气泡：
 * - 用户消息：右侧对齐，蓝色气泡(#4a90d9)，带小三角
 * - 曼波消息：左侧对齐，粉色气泡(#f8a5c2)，带小三角
 * - 文字白色，入场动画（淡入+上浮）
 * - 支持显示情绪图标
 *
 * 整体设计二次元可爱风格，圆角气泡
 */

import React from "react";
import { Emotion } from "./MoodIndicator";

/** 情绪对应的中文标签和图标 */
const EMOTION_MAP: Record<Emotion, { label: string; icon: string }> = {
  happy: { label: "开心", icon: "😊" },
  confused: { label: "困惑", icon: "😕" },
  worried: { label: "担心", icon: "😟" },
  shy: { label: "害羞", icon: "😳" },
  bored: { label: "无聊", icon: "😴" },
  angry: { label: "生气", icon: "😠" },
};

/** 对话气泡组件属性 */
export interface ChatBubbleProps {
  /** 消息内容 */
  text: string;
  /** 是否为用户消息（true=用户，false=曼波） */
  isUser: boolean;
  /** 曼波的情绪状态（仅曼波消息有效） */
  mood?: Emotion;
  /** 消息时间戳（可选） */
  timestamp?: string;
  /** 是否正在流式接收中（仅助手消息） */
  streaming?: boolean;
}

/**
 * 对话气泡组件
 *
 * @param text - 消息内容
 * @param isUser - 是否为用户消息
 * @param mood - 曼波的情绪状态
 * @param timestamp - 消息时间戳
 */
const ChatBubble: React.FC<ChatBubbleProps> = ({
  text,
  isUser,
  mood = "happy",
  timestamp,
  streaming = false,
}) => {
  /**
   * 根据发送者获取气泡容器样式
   */
  const getBubbleContainerStyles = (): string => {
    // 用户消息右对齐，曼波消息左对齐
    return isUser ? "flex justify-end" : "flex justify-start";
  };

  /**
   * 获取气泡主体样式
   */
  const getBubbleStyles = (): string => {
    // 基础气泡样式
    const baseStyles =
      "relative max-w-[75%] px-4 py-3 rounded-cute-lg text-white text-[15px] leading-relaxed break-words shadow-soft ";

    if (isUser) {
      // 用户气泡：蓝色渐变，右侧圆角调整
      return (
        baseStyles +
        "bg-gradient-to-br from-[#4a90d9] to-[#3a7bc8] rounded-tr-sm"
      );
    } else {
      // 曼波气泡：粉色渐变，左侧圆角调整
      return (
        baseStyles +
        "bg-gradient-to-br from-[#f8a5c2] to-[#e887a8] rounded-tl-sm"
      );
    }
  };

  /**
   * 获取小三角箭头样式
   * 用伪元素方式实现气泡尾巴
   */
  const getTriangleStyles = (): string => {
    if (isUser) {
      // 用户气泡三角：在右侧
      return (
        "absolute -right-[6px] top-3 " +
        "w-0 h-0 " +
        "border-t-[8px] border-t-transparent " +
        "border-b-[8px] border-b-transparent " +
        "border-l-[10px] border-l-[#4a90d9]"
      );
    } else {
      // 曼波气泡三角：在左侧
      return (
        "absolute -left-[6px] top-3 " +
        "w-0 h-0 " +
        "border-t-[8px] border-t-transparent " +
        "border-b-[8px] border-b-transparent " +
        "border-r-[10px] border-r-[#f8a5c2]"
      );
    }
  };

  /**
   * 获取发送者名称标签
   */
  const getSenderLabel = (): string => {
    return isUser ? "你" : "曼波";
  };

  /**
   * 获取入场动画类名
   */
  const getAnimationClass = (): string => {
    return isUser ? "animate-slide-in-right" : "animate-slide-in-left";
  };

  /**
   * 获取情绪图标（仅曼波消息）
   */
  const getMoodIcon = (): string => {
    if (isUser) return "";
    return EMOTION_MAP[mood]?.icon || "😊";
  };

  return (
    <div className={`${getBubbleContainerStyles()} ${getAnimationClass()}`}>
      {/* 消息内容区域 */}
      <div className="flex flex-col max-w-[75%]">
        {/* 发送者信息栏 */}
        <div
          className={`
            flex items-center gap-1.5 mb-1 text-xs
            ${isUser ? "justify-end text-[#4a90d9]" : "justify-start text-[#f8a5c2]"}
          `}
        >
          {!isUser && (
            <span className="text-base" role="img" aria-label="情绪">
              {getMoodIcon()}
            </span>
          )}
          <span className="font-semibold opacity-80">{getSenderLabel()}</span>
          {timestamp && (
            <span className="text-[10px] text-[#6b7280] ml-1">{timestamp}</span>
          )}
        </div>

        {/* 气泡主体 */}
        <div className={getBubbleStyles()}>
          {/* 小三角箭头 */}
          <div className={getTriangleStyles()} />

          {/* 消息文字 — 关键修复：处理空内容和流式加载状态 */}
          {text && text.length > 0 ? (
            <p className="relative z-10 whitespace-pre-wrap">{text}</p>
          ) : streaming && !isUser ? (
            /* 流式接收中 — 显示脉冲动画 */
            <div className="relative z-10 flex items-center gap-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="ml-1 text-white/60 text-sm">曼波思考中...</span>
            </div>
          ) : (
            /* 空内容且非流式 — 显示友好提示 */
            <p className="relative z-10 text-white/50 text-sm italic">
              {isUser ? '' : '曼波好像走神了，再试一次吧~'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;

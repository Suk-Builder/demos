/**
 * ChatHistory.tsx - 对话历史组件
 *
 * 显示所有对话消息的列表：
 * - 自动滚动到底部显示最新消息
 * - 支持清空历史记录
 * - 空状态显示提示
 * - 平滑滚动效果
 */

import React, { useEffect, useRef, useCallback } from "react";
import ChatBubble from "./ChatBubble";
import { Emotion } from "./MoodIndicator";

/** 消息数据结构 */
export interface ChatMessage {
  /** 消息唯一ID */
  id: string;
  /** 消息内容 */
  text: string;
  /** 是否为用户发送 */
  isUser: boolean;
  /** 曼波的情绪（仅曼波消息） */
  mood?: Emotion;
  /** 发送时间戳 */
  timestamp?: string;
  /** 是否正在流式接收中（仅助手消息） */
  streaming?: boolean;
}

/** 对话历史组件属性 */
export interface ChatHistoryProps {
  /** 消息列表 */
  messages: ChatMessage[];
  /** 清空历史的回调 */
  onClear?: () => void;
  /** 是否显示清空按钮 */
  showClearButton?: boolean;
}

/**
 * 对话历史组件
 *
 * @param messages - 消息数组
 * @param onClear - 清空历史回调
 * @param showClearButton - 是否显示清空按钮
 */
const ChatHistory: React.FC<ChatHistoryProps> = ({
  messages,
  onClear,
  showClearButton = true,
}) => {
  // 滚动容器的引用
  const scrollRef = useRef<HTMLDivElement>(null);
  // 是否自动滚动的标志
  const shouldAutoScroll = useRef(true);

  /**
   * 自动滚动到底部
   * 当有新消息时自动滚动
   */
  useEffect(() => {
    if (scrollRef.current && shouldAutoScroll.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  /**
   * 处理滚动事件
   * 检测用户是否手动向上滚动，如果是则暂停自动滚动
   */
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      shouldAutoScroll.current = isNearBottom;
    }
  }, []);

  /**
   * 处理清空历史
   */
  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    }
    // 重置自动滚动
    shouldAutoScroll.current = true;
  }, [onClear]);

  /**
   * 格式化时间戳
   */
  const formatTime = (timestamp?: string): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // 空状态渲染
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* 装饰图标 */}
        <div className="text-6xl mb-4 animate-float" role="img" aria-label="曼波">
          🐧
        </div>
        {/* 提示文字 */}
        <p className="text-[#b8c5d6] text-base font-medium mb-2">
          你好呀，我是曼波~
        </p>
        <p className="text-[#6b7280] text-sm text-center">
          按住下方的麦克风按钮，跟我说说话吧
        </p>
        {/* 装饰点 */}
        <div className="flex items-center gap-1.5 mt-6">
          <span className="w-2 h-2 rounded-full bg-[#667eea]/50 animate-blink" />
          <span
            className="w-2 h-2 rounded-full bg-[#667eea]/50 animate-blink"
            style={{ animationDelay: "0.2s" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-[#667eea]/50 animate-blink"
            style={{ animationDelay: "0.4s" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* 消息列表滚动区域 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-4"
      >
        {messages.map((msg, _index) => (
          <ChatBubble
            key={msg.id}
            text={msg.text}
            isUser={msg.isUser}
            mood={msg.mood}
            timestamp={formatTime(msg.timestamp)}
            streaming={msg.streaming}
          />
        ))}
        {/* 底部占位 */}
        <div className="h-2" />
      </div>

      {/* 清空历史按钮 - 仅在 showClearButton 为 true 且消息数大于0 时显示 */}
      {showClearButton && messages.length > 0 && (
        <div className="absolute top-2 right-3 z-10">
          <button
            onClick={handleClear}
            className="
              px-3 py-1.5 rounded-full text-xs font-medium
              bg-[#16213e]/80 text-[#6b7280]
              border border-white/5
              backdrop-blur-sm
              transition-all duration-200
              hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30
              active:scale-95
            "
            aria-label="清空对话历史"
          >
            🗑️ 清空
          </button>
        </div>
      )}

      {/* 底部渐变遮罩（提示还有更多内容） */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#1a1a2e] to-transparent pointer-events-none" />
    </div>
  );
};

export default ChatHistory;

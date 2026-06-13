/**
 * VoiceButton.tsx - 语音按钮组件
 *
 * 大圆形语音交互按钮，根据状态展示不同动画效果：
 * - 空闲(idle)：紫色渐变 + 呼吸动画
 * - 录音中(listening)：红色脉冲动画
 * - 播放中(speaking)：绿色波浪动画 + 声波扩散
 *
 * 点击时有缩放反馈效果，整体设计二次元可爱风格
 */

import React, { useCallback, useRef, useState } from "react";

/** 语音按钮状态类型 */
export type VoiceButtonState = "idle" | "listening" | "speaking";

/** 语音按钮组件属性 */
export interface VoiceButtonProps {
  /** 当前按钮状态 */
  state: VoiceButtonState;
  /** 按下按钮时的回调（开始录音/交互） */
  onPress: () => void;
  /** 释放按钮时的回调（结束录音/交互） */
  onRelease: () => void;
}

/**
 * 语音按钮组件
 *
 * @param state - 当前按钮状态（idle/listening/speaking）
 * @param onPress - 按下回调
 * @param onRelease - 释放回调
 */
const VoiceButton: React.FC<VoiceButtonProps> = ({
  state,
  onPress,
  onRelease,
}) => {
  // 是否被按下的本地状态，用于缩放动画
  const [isPressed, setIsPressed] = useState(false);

  // 防止重复触发的引用
  const isPressedRef = useRef(false);

  /**
   * 处理按下事件
   * 设置按下状态并调用 onPress 回调
   */
  const handlePress = useCallback(() => {
    if (!isPressedRef.current) {
      isPressedRef.current = true;
      setIsPressed(true);
      onPress();
    }
  }, [onPress]);

  /**
   * 处理释放事件
   * 清除按下状态并调用 onRelease 回调
   */
  const handleRelease = useCallback(() => {
    if (isPressedRef.current) {
      isPressedRef.current = false;
      setIsPressed(false);
      onRelease();
    }
  }, [onRelease]);

  /**
   * 处理鼠标按下
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handlePress();
    },
    [handlePress]
  );

  /**
   * 处理鼠标释放
   */
  const handleMouseUp = useCallback(() => {
    handleRelease();
  }, [handleRelease]);

  /**
   * 处理鼠标离开（防止拖拽出去后无法释放）
   */
  const handleMouseLeave = useCallback(() => {
    if (isPressedRef.current) {
      handleRelease();
    }
  }, [handleRelease]);

  /**
   * 处理触摸开始（移动端支持）
   */
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      handlePress();
    },
    [handlePress]
  );

  /**
   * 处理触摸结束（移动端支持）
   */
  const handleTouchEnd = useCallback(() => {
    handleRelease();
  }, [handleRelease]);

  /**
   * 根据状态获取按钮样式类名
   */
  const getButtonStyles = (): string => {
    // 基础样式：大圆形按钮
    // active:scale-95 - CSS 伪类级按下效果（双重保障）
    // will-change-transform - 提示浏览器优化 transform 动画性能
    const baseStyles =
      "w-[120px] h-[120px] rounded-full flex items-center justify-center " +
      "cursor-pointer select-none outline-none " +
      "transition-transform duration-150 ease-out will-change-transform " +
      "active:scale-95 ";

    // 缩放效果：JS 控制按下时缩小（比 active:scale-95 更强，提供更快的响应）
    const pressStyles = isPressed ? "scale-90 " : "scale-100 ";

    // 根据状态选择不同样式
    switch (state) {
      case "listening":
        // 录音中：红色渐变背景
        return (
          baseStyles +
          pressStyles +
          "bg-gradient-to-br from-red-400 to-red-600 shadow-[0_0_40px_rgba(239,68,68,0.6)]"
        );

      case "speaking":
        // 播放中：绿色渐变背景
        return (
          baseStyles +
          pressStyles +
          "bg-gradient-to-br from-green-400 to-green-600 shadow-[0_0_40px_rgba(34,197,94,0.6)]"
        );

      case "idle":
      default:
        // 空闲：紫色渐变背景
        return (
          baseStyles +
          pressStyles +
          "bg-gradient-to-br from-[#667eea] to-[#764ba2] shadow-[0_0_30px_rgba(102,126,234,0.5)]"
        );
    }
  };

  /**
   * 获取状态图标
   */
  const getStateIcon = (): string => {
    switch (state) {
      case "listening":
        return "🎙️"; // 麦克风图标
      case "speaking":
        return "🔊"; // 喇叭图标
      case "idle":
      default:
        return "🎤"; // 录音图标
    }
  };

  /**
   * 获取状态提示文字
   */
  const getStateLabel = (): string => {
    switch (state) {
      case "listening":
        return "聆听中...";
      case "speaking":
        return "说话中...";
      case "idle":
      default:
        return "按住说话";
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 状态提示文字 */}
      <span
        className={`
          text-sm font-medium transition-all duration-300
          ${state === "idle" ? "text-[#b8c5d6]" : ""}
          ${state === "listening" ? "text-red-400 animate-blink" : ""}
          ${state === "speaking" ? "text-green-400" : ""}
        `}
      >
        {getStateLabel()}
      </span>

      {/* 按钮容器（包含波纹效果层） */}
      <div className="relative flex items-center justify-center">
        {/* 脉冲波纹效果 - 仅在录音和播放时显示 */}
        {state !== "idle" && (
          <>
            {/* 外层波纹 */}
            <div
              className={`
                absolute w-[120px] h-[120px] rounded-full
                ${state === "listening" ? "bg-red-500/30 animate-pulse-ring" : ""}
                ${state === "speaking" ? "bg-green-500/30 animate-pulse-ring" : ""}
              `}
              style={{ animationDelay: "0s" }}
            />
            {/* 中层波纹 */}
            <div
              className={`
                absolute w-[120px] h-[120px] rounded-full
                ${state === "listening" ? "bg-red-500/20 animate-pulse-ring" : ""}
                ${state === "speaking" ? "bg-green-500/20 animate-pulse-ring" : ""}
              `}
              style={{ animationDelay: "0.4s" }}
            />
          </>
        )}

        {/* 呼吸动画层 - 仅在空闲时 */}
        {state === "idle" && (
          <div
            className="
              absolute w-[120px] h-[120px] rounded-full
              bg-gradient-to-br from-[#667eea]/40 to-[#764ba2]/40
              animate-breathe
            "
          />
        )}

        {/* 主按钮 */}
        <button
          className={getButtonStyles()}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-label={getStateLabel()}
          aria-pressed={isPressed}
          type="button"
          style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
        >
          {/* 按钮内部图标 */}
          <span
            className={`
              text-4xl transition-transform duration-200
              ${isPressed ? "scale-110" : "scale-100"}
              ${state === "speaking" ? "animate-wave" : ""}
            `}
            role="img"
            aria-hidden="true"
          >
            {getStateIcon()}
          </span>
        </button>
      </div>
    </div>
  );
};

export default VoiceButton;

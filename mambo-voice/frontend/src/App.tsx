/**
 * ============================================================
 * 曼波语音助手 - 主应用入口 (App.tsx)
 * ============================================================
 * 整合所有核心组件，构建完整的语音对话体验：
 *
 * 布局结构（从上到下）：
 *   ┌─────────────────────────────┐
 *   │  顶部栏：Logo + 情绪指示器     │
 *   ├─────────────────────────────┤
 *   │                             │
 *   │      中间：对话历史区域        │  ← 自动滚动
 *   │      (ChatHistory)          │
 *   │                             │
 *   ├─────────────────────────────┤
 *   │      底部：语音大按钮          │  ← 按住说话
 *   │      (VoiceButton)          │
 *   └─────────────────────────────┘
 *
 * 状态管理：全部通过 useChat Hook 统一管理
 * 样式主题：深色背景 #1a1a2e + 紫色渐变 #667eea → #764ba2
 * ============================================================
 */

import React, { useMemo } from 'react';

// ---- 核心 Hook ----
import { useChat } from './hooks/useChat';

// ---- UI 组件 ----
import VoiceButton, { VoiceButtonState } from './components/VoiceButton';
import ChatHistory from './components/ChatHistory';
import MoodIndicator from './components/MoodIndicator';

// ---- 3D 组件 ----
import Scene3D from './components/Scene3D';
import Mambo3D from './components/Mambo3D';

// ---- 3D 类型 ----
import type { Mood, VoiceState } from './types';

// ============================================
// 主应用组件
// ============================================

export default function App(): JSX.Element {
  // ---- 通过 useChat Hook 获取所有状态和操作函数 ----
  const {
    // 对话数据
    messages,
    mood,

    // 语音状态
    isListening,
    isSpeaking,
    isLoading,

    // 输入
    inputText,

    // 操作函数
    sendMessage,
    startVoiceInput,
    stopVoiceInput,
    setInputText,

    // 错误处理
    error,
    clearError,
    clearHistory,

    // 配置
    personality,
    setPersonality,
    voiceEnabled,
    toggleVoice,
  } = useChat();

  // ---- 派生状态 ----

  /**
   * 语音按钮当前状态
   * 优先级：listening > speaking > idle
   * loading 状态不显示在按钮上，通过 UI 其他位置体现
   */
  const voiceButtonState: VoiceButtonState = useMemo(() => {
    if (isListening) return 'listening';
    if (isSpeaking) return 'speaking';
    return 'idle';
  }, [isListening, isSpeaking]);

  /**
   * 将 useChat 的 Message[] 转换为 ChatHistory 需要的 ChatMessage[]
   * 过滤掉系统消息，只显示用户和曼波的对话
   */
  const chatMessages = useMemo(() => {
    return messages
      .filter((msg) => msg.role !== 'system') // 过滤系统消息
      .map((msg) => ({
        id: msg.id,
        text: msg.content,
        isUser: msg.role === 'user',
        mood: msg.role === 'assistant' ? (mood?.current ?? 'happy') : undefined,
        timestamp: msg.timestamp,
        streaming: msg.streaming,
      }));
  }, [messages, mood]);

  /**
   * 曼波当前情绪（用于 MoodIndicator）
   */
  const currentMood = mood?.current ?? 'happy';

  /**
   * 转换为 Mambo3D 需要的 Mood 类型
   */
  const mamboMood: Mood = useMemo(() => {
    const m = currentMood;
    if (m === 'happy' || m === 'confused' || m === 'worried' ||
        m === 'shy' || m === 'bored' || m === 'angry') {
      return m as Mood;
    }
    return 'happy';
  }, [currentMood]);

  /**
   * 转换为 Mambo3D 需要的 VoiceState 类型
   */
  const mamboVoiceState: VoiceState = useMemo(() => {
    if (isListening) return 'listening';
    if (isSpeaking) return 'speaking';
    return 'idle';
  }, [isListening, isSpeaking]);

  /**
   * 3D 形象点击处理
   */
  const handleMamboClick = React.useCallback(() => {
    if (voiceButtonState === 'idle') {
      startVoiceInput();
    }
  }, [voiceButtonState, startVoiceInput]);

  // ---- 事件处理 ----

  /**
   * 处理 VoiceButton 按下（开始录音/交互）
   */
  const handleVoicePress = React.useCallback(() => {
    // 如果正在播报，按下按钮会停止
    if (isSpeaking) {
      startVoiceInput(); // Hook 内部会处理停止播报的逻辑
      return;
    }
    // 开始语音输入
    startVoiceInput();
  }, [isSpeaking, startVoiceInput]);

  /**
   * 处理 VoiceButton 释放（结束录音）
   */
  const handleVoiceRelease = React.useCallback(() => {
    stopVoiceInput();
  }, [stopVoiceInput]);

  /**
   * 处理发送文本消息（回车键发送）
   */
  const handleTextSend = React.useCallback(() => {
    if (inputText.trim()) {
      sendMessage(inputText.trim());
    }
  }, [inputText, sendMessage]);

  /**
   * 处理键盘事件（Enter 发送，Shift+Enter 换行）
   */
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleTextSend();
      }
    },
    [handleTextSend],
  );

  // ============================================
  // 渲染
  // ============================================

  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden relative"
      style={{ backgroundColor: '#1a1a2e' }}
    >
      {/* ============================================================
          顶部栏：曼波 Logo + 情绪指示器 + 语音开关 + 人格切换
          ============================================================ */}
      <header
        className="
          flex items-center justify-between px-4 py-3
          shrink-0 z-20 relative
        "
        style={{
          background: 'linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* 左侧：Logo + 标题 */}
        <div className="flex items-center gap-2.5">
          {/* 曼波 Logo 图标 - SVG 风格 */}
          <div
            className="
              w-9 h-9 rounded-full flex items-center justify-center
            "
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              boxShadow: '0 0 12px rgba(102,126,234,0.4)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="10" r="6" fill="#FFF8F0" />
              <circle cx="10" cy="9" r="1.5" fill="#4A3728" />
              <circle cx="14" cy="9" r="1.5" fill="#4A3728" />
              <circle cx="10.3" cy="8.7" r="0.5" fill="#FFF" />
              <circle cx="14.3" cy="8.7" r="0.5" fill="#FFF" />
              <ellipse cx="12" cy="12" rx="1.5" ry="1" fill="#FF8FAB" />
              <circle cx="7" cy="10" r="1" fill="#FFAAAA" opacity="0.6" />
              <circle cx="17" cy="10" r="1" fill="#FFAAAA" opacity="0.6" />
              <path d="M6 8 Q4 6 5 4" stroke="#2D2D3A" strokeWidth="1" fill="none" strokeLinecap="round" />
              <path d="M18 8 Q20 6 19 4" stroke="#2D2D3A" strokeWidth="1" fill="none" strokeLinecap="round" />
              <path d="M9 14 Q12 17 15 14" stroke="#FF6B9D" strokeWidth="0.8" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          {/* 标题 */}
          <div className="flex flex-col">
            <h1
              className="text-base font-bold leading-tight"
              style={{
                background: 'linear-gradient(135deg, #a78bfa, #f8a5c2)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              曼波语音助手
            </h1>
            <span className="text-[10px] text-[#6b7280] leading-tight">
              {isLoading ? '思考中...' : '你好呀~'}
            </span>
          </div>
        </div>

        {/* 右侧：情绪指示器 + 语音开关 + 人格切换 */}
        <div className="flex items-center gap-2.5">
          {/* 人格切换下拉框 */}
          <select
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            className="
              text-xs rounded-full px-2.5 py-1
              bg-[#16213e]/80 text-[#b8c5d6]
              border border-white/5
              outline-none cursor-pointer
              transition-all duration-200
              hover:border-[#667eea]/30
            "
            aria-label="切换人格模式"
          >
            <option value="mambo">🐧 曼波</option>
            <option value="baihua">🎭 白话</option>
            <option value="drama">🎬 戏精</option>
          </select>

          {/* 语音开关按钮 */}
          <button
            onClick={toggleVoice}
            className={`
              flex items-center gap-1 px-2.5 py-1 rounded-full
              text-xs font-medium transition-all duration-200
              border
              ${
                voiceEnabled
                  ? 'bg-[#16213e]/80 text-green-400 border-green-500/20 hover:bg-green-500/10'
                  : 'bg-[#16213e]/80 text-[#6b7280] border-white/5 hover:bg-red-500/10 hover:text-red-400'
              }
            `}
            aria-label={voiceEnabled ? '关闭语音播报' : '开启语音播报'}
          >
            {voiceEnabled ? '🔊' : '🔇'}
            <span className="hidden sm:inline">{voiceEnabled ? '语音开' : '语音关'}</span>
          </button>

          {/* 情绪指示器 */}
          <MoodIndicator mood={currentMood} showLabel={false} animate={true} />
        </div>
      </header>

      {/* ============================================================
          3D 形象展示区
          ============================================================ */}
      <div
        className="shrink-0 relative"
        style={{
          height: 240,
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Scene3D mood={mamboMood} voiceState={mamboVoiceState}>
          <Mambo3D
            mood={mamboMood}
            voiceState={mamboVoiceState}
            onClick={handleMamboClick}
          />
        </Scene3D>
        {/* 底部渐变过渡遮罩 */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: 30,
            background: 'linear-gradient(to bottom, transparent, #1a1a2e)',
          }}
        />
      </div>

      {/* ============================================================
          中间区域：对话历史（自动滚动到底部）
          ============================================================ */}
      <main className="flex-1 min-h-0 relative">
        <ChatHistory messages={chatMessages} onClear={clearHistory} showClearButton={true} />

        {/* 加载中指示器 */}
        {isLoading && (
          <div
            className="
              absolute bottom-4 left-1/2 -translate-x-1/2
              flex items-center gap-2 px-4 py-2 rounded-full
              text-xs text-[#b8c5d6]
              bg-[#16213e]/90 backdrop-blur-sm
              border border-white/5
              z-10
            "
          >
            <div className="w-4 h-4 border-2 border-[#667eea] border-t-transparent rounded-full animate-spin" />
            <span>曼波正在思考...</span>
          </div>
        )}
      </main>

      {/* ============================================================
          文本输入栏（在语音按钮上方）
          ============================================================ */}
      <div
        className="shrink-0 px-4 py-2.5"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(22,33,62,0.5)',
        }}
      >
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          {/* 文本输入框 */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，按 Enter 发送..."
            rows={1}
            className="
              flex-1 resize-none
              px-4 py-2 rounded-2xl
              text-sm text-white placeholder-[#6b7280]
              bg-[#16213e]/80
              border border-white/5
              outline-none
              transition-all duration-200
              focus:border-[#667eea]/40 focus:bg-[#16213e]
              scrollbar-hide
            "
            style={{ maxHeight: 80, minHeight: 36 }}
            aria-label="文本输入框"
          />
          {/* 发送按钮 */}
          <button
            onClick={handleTextSend}
            disabled={!inputText.trim() || isLoading}
            className={`
              shrink-0 w-9 h-9 rounded-full
              flex items-center justify-center
              text-lg transition-all duration-200
              ${
                inputText.trim() && !isLoading
                  ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white cursor-pointer hover:scale-105 hover:shadow-[0_0_16px_rgba(102,126,234,0.5)]'
                  : 'bg-[#16213e] text-[#6b7280] cursor-not-allowed opacity-50'
              }
            `}
            aria-label="发送消息"
          >
            ➤
          </button>
        </div>
      </div>

      {/* ============================================================
          底部：VoiceButton 大圆形语音按钮
          ============================================================ */}
      <div
        className="shrink-0 flex flex-col items-center pb-5 pt-2"
        style={{
          background: 'linear-gradient(to top, rgba(26,26,46,1) 0%, rgba(26,26,46,0.95) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* 语音大按钮 */}
        <VoiceButton
          state={voiceButtonState}
          onPress={handleVoicePress}
          onRelease={handleVoiceRelease}
        />

        {/* 底部提示文字 */}
        <p className="text-[10px] text-[#6b7280] mt-2 text-center">
          {isListening
            ? '正在聆听，松开发送...'
            : isSpeaking
              ? '正在播报语音...'
              : isLoading
                ? '处理中，请稍候...'
                : '按住麦克风按钮说话，或输入文字发送'}
        </p>
      </div>

      {/* ============================================================
          错误提示弹窗
          ============================================================ */}
      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="
              mx-4 max-w-sm w-full
              rounded-2xl p-5
              flex flex-col items-center gap-3
            "
            style={{
              background: '#16213e',
              border: '1px solid rgba(248,113,113,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* 错误图标 */}
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            {/* 错误标题 */}
            <h3 className="text-white font-semibold text-base">出错了</h3>
            {/* 错误信息 */}
            <p className="text-[#b8c5d6] text-sm text-center leading-relaxed">{error}</p>
            {/* 确认按钮 */}
            <button
              onClick={clearError}
              className="
                mt-1 px-6 py-2 rounded-full
                text-sm font-medium text-white
                transition-all duration-200
                hover:scale-105 active:scale-95
              "
              style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
              }}
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

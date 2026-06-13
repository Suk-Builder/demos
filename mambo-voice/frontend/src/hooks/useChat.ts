// ============================================
// 曼波语音助手 — 对话核心Hook
// 功能：整合语音识别→API调用→语音合成的完整对话流程
//        管理对话状态、情绪变化、语音按钮状态机
// ============================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { api, Message, ApiError } from '../api/client';
import {
  detectEmotion,
  Emotion,
  EmotionState,
} from '../utils/emotionFSM';

// ---- 类型定义 ----

/** SpeechRecognition 相关类型声明（DOM API 在 TypeScript 中未完整定义） */
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

/** 语音按钮的状态枚举（有限状态机） */
enum VoiceButtonState {
  IDLE = 'idle',             // 空闲 - 等待用户操作
  LISTENING = 'listening',   // 聆听中 - 正在接收语音输入
  PROCESSING = 'processing', // 处理中 - 发送请求/等待响应
  SPEAKING = 'speaking',     // 播报中 - 正在播放语音回复
  ERROR = 'error',           // 错误状态 - 发生异常
}

/** Hook返回的完整接口 */
export interface UseChatReturn {
  // ---- 对话数据 ----
  /** 对话消息列表 */
  messages: Message[];
  /** 曼波当前情绪状态 */
  mood: EmotionState;
  /** 当前用户输入文本（用于文本输入框） */
  inputText: string;

  // ---- 语音状态 ----
  /** 是否正在聆听（语音识别中） */
  isListening: boolean;
  /** 是否正在播报（语音合成中） */
  isSpeaking: boolean;
  /** 是否正在处理（API请求中） */
  isLoading: boolean;
  /** 语音按钮当前状态 */
  voiceState: VoiceButtonState;

  // ---- 操作函数 ----
  /** 发送文本消息 */
  sendMessage: (text: string) => void;
  /** 开始语音输入 */
  startVoiceInput: () => void;
  /** 停止语音输入 */
  stopVoiceInput: () => void;
  /** 设置输入文本 */
  setInputText: (text: string) => void;
  /** 清空对话历史 */
  clearHistory: () => Promise<void>;
  /** 停止语音播报 */
  stopSpeaking: () => void;

  // ---- 错误处理 ----
  /** 当前错误信息（null表示无错误） */
  error: string | null;
  /** 清除错误 */
  clearError: () => void;

  // ---- 配置 ----
  /** 当前使用的个性模式 */
  personality: string;
  /** 切换个性模式 */
  setPersonality: (p: string) => void;
  /** 是否启用语音回复 */
  voiceEnabled: boolean;
  /** 切换语音开关 */
  toggleVoice: () => void;
}

// ---- 工具函数 ----

/**
 * 生成唯一消息ID
 */
const generateMessageId = (): string =>
  `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

/**
 * 创建系统消息
 */
const createSystemMessage = (content: string): Message => ({
  id: generateMessageId(),
  content,
  role: 'system',
  timestamp: new Date().toISOString(),
});

/**
 * 创建用户消息
 */
const createUserMessage = (content: string): Message => ({
  id: generateMessageId(),
  content,
  role: 'user',
  timestamp: new Date().toISOString(),
});

/**
 * 创建助手消息（初始为空，流式填充）
 */
const createAssistantMessage = (): Message => ({
  id: generateMessageId(),
  content: '',
  role: 'assistant',
  timestamp: new Date().toISOString(),
  streaming: true,
});

// ---- 默认情绪状态 ----
const DEFAULT_MOOD: EmotionState = {
  current: 'happy',
  intensity: 0.5,
  duration: 0,
  startTime: Date.now(),
};

/**
 * useChat Hook — 曼波对话核心逻辑
 *
 * 使用示例:
 * ```tsx
 * const {
 *   messages, isListening, isSpeaking, mood,
 *   sendMessage, startVoiceInput, stopVoiceInput
 * } = useChat();
 * ```
 */
export const useChat = (): UseChatReturn => {
  // ---- 状态定义 ----

  // 对话消息列表
  const [messages, setMessages] = useState<Message[]>(() => {
    // 从localStorage恢复历史对话
    try {
      const saved = localStorage.getItem('mambo_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 只保留最近50条
        return parsed.slice(-50);
      }
    } catch {
      // 忽略解析错误
    }
    // 首次使用的欢迎消息
    return [createSystemMessage('我是曼波，你的语音助手！点击麦克风按钮和我聊天吧~')];
  });

  // 当前输入文本
  const [inputText, setInputText] = useState('');

  // 曼波情绪状态
  const [mood, setMood] = useState<EmotionState>(DEFAULT_MOOD);

  // 语音按钮状态机
  const [voiceState, setVoiceState] = useState<VoiceButtonState>(VoiceButtonState.IDLE);

  // 错误信息
  const [error, setError] = useState<string | null>(null);

  // 个性模式
  const [personality, setPersonality] = useState<string>(() => {
    return localStorage.getItem('mambo_personality') || 'mambo';
  });

  // 语音开关
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('mambo_voice_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  // ---- Refs（跨渲染周期保持引用） ----

  /** 语音识别实例 */
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /** 语音合成实例 */
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  /** 是否取消当前请求 */
  const cancelledRef = useRef(false);
  /** 静音检测计时器 */
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 消息列表Ref（用于回调中访问最新值） */
  const messagesRef = useRef(messages);

  // 同步Ref
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ---- 持久化对话历史 ----

  useEffect(() => {
    try {
      localStorage.setItem('mambo_chat_history', JSON.stringify(messages.slice(-50)));
    } catch {
      // 存储空间不足时静默处理
    }
  }, [messages]);

  // ---- 语音合成(TTS) ----

  /**
   * 使用Web Speech API播放语音
   * @param text 要播报的文本
   */
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('浏览器不支持语音合成'));
        return;
      }

      // 取消之前的播报
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // 配置语音参数（根据情绪调整）
      const currentMood = mood;
      utterance.rate = currentMood.current === 'happy' ? 1.2 :
                       currentMood.current === 'bored' ? 0.9 : 1.0;
      utterance.pitch = currentMood.current === 'happy' ? 1.1 :
                        currentMood.current === 'worried' ? 0.85 : 1.0;
      utterance.volume = voiceEnabled ? 1.0 : 0;
      utterance.lang = 'zh-CN';

      // 事件处理
      utterance.onstart = () => {
        setVoiceState(VoiceButtonState.SPEAKING);
      };

      utterance.onend = () => {
        setVoiceState(VoiceButtonState.IDLE);
        utteranceRef.current = null;
        resolve();
      };

      utterance.onerror = (event) => {
        if (event.error !== 'canceled') {
          console.warn('[TTS] 语音播报错误:', event.error);
          setVoiceState(VoiceButtonState.IDLE);
        }
        utteranceRef.current = null;
        resolve(); // 错误时不reject，避免阻塞流程
      };

      window.speechSynthesis.speak(utterance);
    });
  }, [mood, voiceEnabled]);

  /**
   * 停止语音播报
   */
  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    if (voiceState === VoiceButtonState.SPEAKING) {
      setVoiceState(VoiceButtonState.IDLE);
    }
  }, [voiceState]);

  // ---- 语音识别(STT) ----

  /**
   * 初始化语音识别引擎
   */
  const initSpeechRecognition = useCallback((): SpeechRecognition | null => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError('您的浏览器不支持语音识别，请使用Chrome或Edge');
      return null;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    // 识别到语音时触发
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // 更新输入文本（显示识别中的文字）
      setInputText(finalTranscript + interimTranscript);

      // 重置静音检测计时器
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        // 检测到静音，自动停止识别并发送
        if (finalTranscript.trim()) {
          recognition.stop();
          handleSend(finalTranscript.trim());
        }
      }, 2000);
    };

    // 识别结束时触发
    recognition.onend = () => {
      // 如果有最终结果，发送消息
      if (finalTranscript.trim() && !cancelledRef.current) {
        handleSend(finalTranscript.trim());
      }
      finalTranscript = '';
      setVoiceState(VoiceButtonState.IDLE);
      recognitionRef.current = null;
    };

    // 识别错误时触发
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[STT] 语音识别错误:', event.error);
      if (event.error === 'no-speech') {
        setError('没有检测到语音，请再试一次');
      } else if (event.error === 'audio-capture') {
        setError('无法访问麦克风，请检查权限设置');
      } else if (event.error === 'not-allowed') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许访问');
      } else {
        setError(`语音识别错误: ${event.error}`);
      }
      setVoiceState(VoiceButtonState.ERROR);
      setTimeout(() => setVoiceState(VoiceButtonState.IDLE), 3000);
    };

    return recognition;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 核心对话逻辑 ----

  /**
   * 处理发送消息（被语音识别和手动输入共用）
   * @param text 要发送的文本
   */
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // 重置取消标志
    cancelledRef.current = false;

    // 创建用户消息
    const userMessage = createUserMessage(text.trim());
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setError(null);
    setVoiceState(VoiceButtonState.PROCESSING);

    // 创建待填充的助手消息
    const assistantMessage = createAssistantMessage();
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // 使用流式API获取回复
      let fullContent = '';

      await api.chatStream(text.trim(), personality, (chunk) => {
        if (cancelledRef.current) return;

        if (chunk.done) {
          // 流式传输完成
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: fullContent, streaming: false }
                : msg,
            ),
          );
        } else {
          fullContent += chunk.content;
          // 实时更新消息内容（打字机效果）
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: fullContent }
                : msg,
            ),
          );
        }
      });

      // 根据用户输入检测并更新情绪状态（本地检测，不依赖后端）
      try {
        const negativeStreak = messagesRef.current.reduce((count, msg, idx, arr) => {
          if (msg.role !== 'user') return count;
          const lower = msg.content.toLowerCase();
          const isNegative = ['难过', '伤心', '累', '痛苦', '烦', '郁闷', '焦虑', '担心', '害怕', '孤独', '讨厌', 'sad', 'tired', 'upset', 'angry', 'hate', '烦死了', '压力'].some(
            (w) => lower.includes(w),
          );
          return isNegative ? count + 1 : 0;
        }, 0);

        const detectedEmotion = detectEmotion(text, {
          history: messagesRef.current.slice(-10).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          negativeStreak,
          idleTime: 0,
          personality: (personality as 'mambo' | 'baihua' | 'drama') || 'mambo',
        });

        setMood({
          current: detectedEmotion,
          intensity: 0.6,
          duration: 0,
          startTime: Date.now(),
        });
      } catch {
        // 情绪检测失败不影响主流程
      }

      // 语音播报（如果开启）
      if (voiceEnabled && fullContent && !cancelledRef.current) {
        await speak(fullContent);
      } else {
        setVoiceState(VoiceButtonState.IDLE);
      }
    } catch (err) {
      if (cancelledRef.current) return;

      const errorMessage = err instanceof ApiError
        ? err.message
        : '连接失败，请检查网络后重试';

      setError(errorMessage);

      // 更新助手消息为错误状态
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? { ...msg, content: '抱歉，我遇到了一些问题...', streaming: false }
            : msg,
        ),
      );

      setVoiceState(VoiceButtonState.ERROR);
      setTimeout(() => setVoiceState(VoiceButtonState.IDLE), 3000);
    }
  }, [personality, voiceEnabled, speak]);

  /**
   * 发送文本消息（供UI文本输入框调用）
   */
  const sendMessage = useCallback((text: string) => {
    handleSend(text);
  }, [handleSend]);

  /**
   * 开始语音输入
   */
  const startVoiceInput = useCallback(() => {
    // 如果正在播报，先停止
    if (voiceState === VoiceButtonState.SPEAKING) {
      stopSpeaking();
      return;
    }

    // 如果正在聆听，停止
    if (voiceState === VoiceButtonState.LISTENING) {
      stopVoiceInput();
      return;
    }

    setError(null);
    const recognition = initSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    setVoiceState(VoiceButtonState.LISTENING);

    try {
      recognition.start();
    } catch (err) {
      console.error('[STT] 启动识别失败:', err);
      setError('语音识别启动失败');
      setVoiceState(VoiceButtonState.IDLE);
    }
  }, [voiceState, initSpeechRecognition, stopSpeaking]);

  /**
   * 停止语音输入
   */
  const stopVoiceInput = useCallback(() => {
    cancelledRef.current = true;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // 忽略停止时的错误
      }
      recognitionRef.current = null;
    }

    setVoiceState(VoiceButtonState.IDLE);
  }, []);

  /**
   * 清空对话历史
   */
  const clearHistory = useCallback(async () => {
    try {
      await api.clearHistory();
    } catch {
      // 后端清除失败不影响本地清除
    }
    setMessages([createSystemMessage('对话已清空，我是曼波，有什么我可以帮你的吗？')]);
    setMood(DEFAULT_MOOD);
    try {
      localStorage.removeItem('mambo_chat_history');
    } catch {
      // 忽略存储错误
    }
  }, []);

  /**
   * 清除错误信息
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 切换语音开关
   */
  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('mambo_voice_enabled', String(next));
      if (!next) {
        // 关闭时立即停止播报
        stopSpeaking();
      }
      return next;
    });
  }, [stopSpeaking]);

  // ---- 生命周期管理 ----

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopVoiceInput();
      stopSpeaking();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [stopVoiceInput, stopSpeaking]);

  // 页面可见性变化处理（切换标签页时暂停播报）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && voiceState === VoiceButtonState.SPEAKING) {
        window.speechSynthesis?.pause();
      } else if (!document.hidden && voiceState === VoiceButtonState.SPEAKING) {
        window.speechSynthesis?.resume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [voiceState]);

  // ---- 返回值 ----

  return {
    // 对话数据
    messages,
    mood,
    inputText,

    // 语音状态（兼容旧接口）
    isListening: voiceState === VoiceButtonState.LISTENING,
    isSpeaking: voiceState === VoiceButtonState.SPEAKING,
    isLoading: voiceState === VoiceButtonState.PROCESSING,
    voiceState,

    // 操作函数
    sendMessage,
    startVoiceInput,
    stopVoiceInput,
    setInputText,
    clearHistory,
    stopSpeaking,

    // 错误处理
    error,
    clearError,

    // 配置
    personality,
    setPersonality: (p: string) => {
      setPersonality(p);
      localStorage.setItem('mambo_personality', p);
    },
    voiceEnabled,
    toggleVoice,
  };
};

export default useChat;

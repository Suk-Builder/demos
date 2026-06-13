/**
 * useSpeechRecognition.ts
 * Web Speech API 语音识别 Hook
 *
 * 提供浏览器原生语音识别功能，支持中文(zh-CN)识别、
 * 实时文本获取、错误处理和自动停止等功能。
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================
// 类型定义
// ============================================================

/** 麦克风权限状态 */
export type MicrophonePermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

/** 语音识别Hook返回值接口 */
export interface UseSpeechRecognitionReturn {
  /** 是否正在监听 */
  isListening: boolean;
  /** 识别的文本内容 */
  transcript: string;
  /** 临时识别文本（实时更新，未最终结果） */
  interimTranscript: string;
  /** 启动语音识别 */
  startListening: () => void;
  /** 停止语音识别 */
  stopListening: () => void;
  /** 重置所有状态 */
  reset: () => void;
  /** 错误信息 */
  error: string | null;
  /** 浏览器是否支持语音识别 */
  isSupported: boolean;
  /** 麦克风权限状态 */
  permissionState: MicrophonePermissionState;
  /** 主动请求麦克风权限 */
  requestPermission: () => Promise<void>;
}

/** 语音识别配置选项 */
interface SpeechRecognitionOptions {
  /** 识别语言，默认 zh-CN */
  lang?: string;
  /** 是否连续识别，默认 true */
  continuous?: boolean;
  /** 是否返回临时结果，默认 true */
  interimResults?: boolean;
  /** 最大备选结果数，默认 1 */
  maxAlternatives?: number;
  /** 静音超时时间（毫秒），默认 3000 */
  silenceTimeout?: number;
}

// ============================================================
// Web Speech API 类型扩展（兼容各浏览器前缀）
// ============================================================

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取语音识别构造函数
 * 兼容各浏览器前缀（webkit等）
 */
const getSpeechRecognitionConstructor = ():
  | typeof window.SpeechRecognition
  | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (
    window.SpeechRecognition || window.webkitSpeechRecognition || undefined
  );
};

/**
 * 麦克风权限设置引导信息
 * 根据用户浏览器类型提供针对性的设置指引
 */
const getMicrophonePermissionGuide = (): string => {
  const userAgent = navigator.userAgent.toLowerCase();

  // 检测浏览器类型
  const isChrome = /chrome/.test(userAgent) && !/edge|edg/.test(userAgent);
  const isEdge = /edge|edg/.test(userAgent);
  const isFirefox = /firefox/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);

  if (isEdge) {
    return '请在地址栏左侧点击 🔒 图标 → 网站权限 → 麦克风 → 选择"允许"';
  }
  if (isFirefox) {
    return '请点击地址栏左侧的 🎤 图标 → 撤销此权限限制 → 重新加载页面并允许';
  }
  if (isSafari) {
    return '请打开 Safari 偏好设置 → 网站 → 麦克风 → 找到本站并设置为"允许"';
  }
  // Chrome 和默认指引
  return '请点击地址栏左侧的 🔒 图标 → 网站设置 → 麦克风 → 选择"允许"，然后刷新页面';
};

/**
 * 将语音识别错误码转换为中文错误信息
 * 对权限相关错误提供详细的设置引导
 */
const getErrorMessage = (event: SpeechRecognitionErrorEvent): string => {
  const errorMap: Record<string, string> = {
    noSpeech: '未检测到语音，请尝试大声说话',
    audioCapture: '无法访问麦克风，请检查设备连接',
    notAllowed: `麦克风权限被拒绝 🎤\n\n${getMicrophonePermissionGuide()}`,
    network: '网络错误，请检查网络连接',
    aborted: '语音识别已取消',
    languageNotSupported: '当前语言不支持',
    badGrammar: '语法文件错误',
    serviceNotAllowed: '语音识别服务不可用',
  };
  return errorMap[event.error] || `语音识别错误: ${event.error}`;
};

// ============================================================
// 主 Hook
// ============================================================

/**
 * 语音识别 Hook
 *
 * 使用浏览器原生 Web Speech API 实现语音识别功能。
 * 支持中文识别、实时文本获取、错误处理和静音超时自动停止。
 *
 * @example
 * ```tsx
 * const { isListening, transcript, startListening, stopListening, error } = useSpeechRecognition({
 *   lang: 'zh-CN',
 *   silenceTimeout: 3000,
 * });
 * ```
 */
export function useSpeechRecognition(
  options: SpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  // 解构配置，设置默认值
  const {
    lang = 'zh-CN',
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
    silenceTimeout = 3000,
  } = options;

  // ---- 状态管理 ----
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>('unknown');

  // ---- Ref 管理 ----
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const permissionCheckedRef = useRef(false);

  // 同步 isListening 状态到 ref
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // ---- 检测麦克风权限状态 ----
  useEffect(() => {
    if (permissionCheckedRef.current) return;
    permissionCheckedRef.current = true;

    const checkPermission = async () => {
      try {
        // 使用 Permissions API 检测（如果浏览器支持）
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });
          setPermissionState(result.state as MicrophonePermissionState);

          // 监听权限变化
          result.addEventListener('change', () => {
            setPermissionState(result.state as MicrophonePermissionState);
            // 如果权限变为允许，清除之前的错误
            if (result.state === 'granted') {
              setError(null);
            }
          });
        } else {
          // 不支持 Permissions API，回退到 getUserMedia 检测
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            setPermissionState('granted');
            // 立即释放轨道
            stream.getTracks().forEach((track) => track.stop());
          } catch {
            setPermissionState('prompt');
          }
        }
      } catch {
        setPermissionState('unknown');
      }
    };

    checkPermission();
  }, []);

  // 检查浏览器支持
  const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
  const isSupported = SpeechRecognitionCtor !== undefined;

  // ---- 清理静音定时器 ----
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // ---- 主动请求麦克风权限 ----
  const requestPermission = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setPermissionState('granted');
      // 立即释放轨道
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionState('denied');
          setError(`麦克风权限被拒绝 🎤\n\n${getMicrophonePermissionGuide()}`);
          return;
        }
        if (err.name === 'NotFoundError') {
          setError('未找到麦克风设备，请检查麦克风是否连接');
          return;
        }
      }
      setError('请求麦克风权限失败，请检查浏览器设置');
    }
  }, []);

  // ---- 停止语音识别 ----
  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // 如果已经停止，忽略错误
      }
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  // ---- 启动语音识别 ----
  const startListening = useCallback(() => {
    // 前置检查
    if (!SpeechRecognitionCtor) {
      setError('当前浏览器不支持语音识别功能');
      return;
    }
    if (isListeningRef.current) {
      // 如果已经在监听，先停止再重新启动
      stopListening();
      setTimeout(() => startListening(), 100);
      return;
    }

    // 权限检查：如果被拒绝，显示引导提示
    if (permissionState === 'denied') {
      setError(`麦克风权限已被拒绝 🎤\n\n${getMicrophonePermissionGuide()}`);
      return;
    }

    // 重置状态
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';

    // 创建语音识别实例
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;

    // 配置参数
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = maxAlternatives;

    // ---- 事件处理 ----

    /** 识别开始 */
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    /** 识别结果（实时更新） */
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      clearSilenceTimer();

      let interim = '';
      let final = finalTranscriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;

        if (result.isFinal) {
          // 最终结果
          final += transcriptText;
        } else {
          // 临时结果
          interim += transcriptText;
        }
      }

      finalTranscriptRef.current = final;
      setTranscript(final);
      setInterimTranscript(interim);

      // 重置静音定时器
      silenceTimerRef.current = setTimeout(() => {
        if (isListeningRef.current) {
          stopListening();
        }
      }, silenceTimeout);
    };

    /** 识别错误 */
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 忽略主动取消的错误
      if (event.error === 'aborted') return;

      const errorMsg = getErrorMessage(event);
      setError(errorMsg);
      setIsListening(false);
      clearSilenceTimer();
    };

    /** 识别结束 */
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      clearSilenceTimer();

      // 确保最终结果已同步
      if (finalTranscriptRef.current) {
        setTranscript(finalTranscriptRef.current);
      }
    };

    /** 没有检测到语音 */
    (recognition as any).onnomatch = () => {
      setError('未识别到语音内容');
    };

    // 启动识别
    try {
      recognition.start();
    } catch {
      setError('启动语音识别失败，请重试');
    }
  }, [
    SpeechRecognitionCtor,
    lang,
    continuous,
    interimResults,
    maxAlternatives,
    silenceTimeout,
    stopListening,
    clearSilenceTimer,
    permissionState,
  ]);

  // ---- 重置所有状态 ----
  const reset = useCallback(() => {
    stopListening();
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    finalTranscriptRef.current = '';
  }, [stopListening]);

  // ---- 组件卸载时清理 ----
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // 忽略停止错误
        }
      }
    };
  }, [clearSilenceTimer]);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    reset,
    error,
    isSupported,
    permissionState,
    requestPermission,
  };
}

export default useSpeechRecognition;

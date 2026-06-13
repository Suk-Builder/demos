/**
 * useTextToSpeech.ts
 * Edge-TTS 语音合成 Hook
 *
 * 使用微软 Edge-TTS 在线服务将文字转为语音并自动播放。
 * 支持播放、打断、语速/音调调节等功能。
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================
// 类型定义
// ============================================================

/** 语音合成Hook返回值接口 */
export interface UseTextToSpeechReturn {
  /** 是否正在播放 */
  isSpeaking: boolean;
  /** 开始语音合成并播放 */
  speak: (text: string) => Promise<void>;
  /** 停止播放 */
  stop: () => void;
  /** 暂停播放 */
  pause: () => void;
  /** 恢复播放 */
  resume: () => void;
  /** 错误信息 */
  error: string | null;
  /** 当前播放的音频对象（用于外部控制） */
  audioElement: HTMLAudioElement | null;
}

/** 语音配置选项 */
interface TextToSpeechOptions {
  /** 语音名称，默认 zh-CN-XiaoxiaoNeural（女性中文） */
  voice?: string;
  /** 语速，范围 0.5 ~ 2.0，默认 1.0 */
  rate?: number;
  /** 音调，范围 0.5 ~ 2.0，默认 1.0 */
  pitch?: number;
  /** 音量，范围 0 ~ 1，默认 1.0 */
  volume?: number;
  /** 播放完成回调 */
  onEnd?: () => void;
  /** 播放错误回调 */
  onError?: (error: string) => void;
}

/** Edge-TTS 请求体 */
interface EdgeTTSRequestBody {
  text: string;
  voice: string;
  rate: string;
  pitch: string;
  volume: string;
}

// ============================================================
// 常量
// ============================================================

/** Edge-TTS API 端点 */
const EDGE_TTS_URL =
  'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/v1';

/** Edge-TTS 获取音频流的 API */
const EDGE_TTS_STREAM_URL =
  'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/v1?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';

/** 默认语音配置 */
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_RATE = 1.0;
const DEFAULT_PITCH = 1.0;
const DEFAULT_VOLUME = 1.0;

// ============================================================
// 辅助函数
// ============================================================

/**
 * 将数值参数转换为 Edge-TTS 要求的字符串格式
 * @param value 数值参数
 * @returns 格式化的字符串，如 "+0%" 或 "-10%"
 */
const formatSsmlParam = (value: number): string => {
  const percentage = Math.round((value - 1) * 100);
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage}%`;
};

/**
 * 生成 SSML 格式的请求体
 * @param text 要合成的文本
 * @param voice 语音名称
 * @param rate 语速
 * @param pitch 音调
 * @param volume 音量
 * @returns Edge-TTS 请求体
 */
const buildTTSRequestBody = (
  text: string,
  voice: string,
  rate: number,
  pitch: number,
  volume: number
): EdgeTTSRequestBody => ({
  text,
  voice,
  rate: formatSsmlParam(rate),
  pitch: formatSsmlParam(pitch),
  volume: formatSsmlParam(volume),
});

/**
 * 通过 Web Audio API 将音频数据解码为 AudioBuffer
 * 用于兼容不同格式的音频数据
 */
const decodeAudioData = async (
  audioContext: AudioContext,
  arrayBuffer: ArrayBuffer
): Promise<AudioBuffer> => {
  return new Promise((resolve, reject) => {
    audioContext.decodeAudioData(
      arrayBuffer,
      (buffer) => resolve(buffer),
      (err) => reject(err)
    );
  });
};

/**
 * 计算音频时长（毫秒）
 */
const getAudioDuration = (audioBuffer: AudioBuffer): number => {
  return audioBuffer.duration * 1000;
};

// ============================================================
// 主 Hook
// ============================================================

/**
 * Edge-TTS 语音合成 Hook
 *
 * 使用微软 Edge 浏览器在线 TTS 服务，免费且质量高。
 * 支持中文女声 XiaoxiaoNeural，可调节语速和音调。
 *
 * @example
 * ```tsx
 * const { isSpeaking, speak, stop, error } = useTextToSpeech({
 *   voice: 'zh-CN-XiaoxiaoNeural',
 *   rate: 1.2,
 *   onEnd: () => console.log('播放完成'),
 * });
 *
 * // 播放语音
 * await speak('你好，我是曼波语音助手');
 *
 * // 打断播放
 * stop();
 * ```
 */
export function useTextToSpeech(
  options: TextToSpeechOptions = {}
): UseTextToSpeechReturn {
  // ---- 解构配置 ----
  const {
    voice = DEFAULT_VOICE,
    rate = DEFAULT_RATE,
    pitch = DEFAULT_PITCH,
    volume = DEFAULT_VOLUME,
    onEnd,
    onError,
  } = options;

  // ---- 状态管理 ----
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Ref 管理 ----
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSpeakingRef = useRef(false);

  // 同步状态到 ref
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // ---- 停止播放 ----
  const stop = useCallback(() => {
    // 取消进行中的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 停止音频播放
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    setIsSpeaking(false);
  }, []);

  // ---- 暂停播放 ----
  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }
  }, []);

  // ---- 恢复播放 ----
  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch((err) => {
        setError(`恢复播放失败: ${err.message}`);
      });
      setIsSpeaking(true);
    }
  }, []);

  // ---- 语音合成主函数 ----
  const speak = useCallback(
    async (text: string): Promise<void> => {
      // 前置检查
      if (!text || text.trim().length === 0) {
        const errMsg = '合成文本不能为空';
        setError(errMsg);
        onError?.(errMsg);
        return;
      }

      // 如果正在播放，先打断
      stop();

      // 清除之前的错误
      setError(null);

      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        setIsSpeaking(true);

        // 构建 SSML 请求
        const requestBody = buildTTSRequestBody(text, voice, rate, pitch, volume);

        // 方法：通过自建代理或直接调用
        // 注意：Edge-TTS 接口为内部接口，实际项目中建议自建后端代理
        // 这里提供客户端直连方案（可能被 CORS 限制）和后端代理方案

        // 方案1：尝试直连 Edge-TTS（可能受 CORS 限制）
        // 方案2：通过自建后端代理（推荐）
        // 这里使用 Blob URL 方案结合 Audio 元素

        // 构建 SSML
        const ssml = `
          <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
            <voice name="${requestBody.voice}">
              <prosody rate="${requestBody.rate}" pitch="${requestBody.pitch}" volume="${requestBody.volume}">
                ${text}
              </prosody>
            </voice>
          </speak>
        `;

        // 发送请求获取音频
        // 注意：实际使用需解决 CORS 问题，建议通过自建后端转发
        const audioData = await fetchEdgeTTS(ssml, abortController.signal);

        if (abortController.signal.aborted) {
          return;
        }

        // 创建音频 Blob
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);

        // 创建并配置 Audio 元素
        const audio = new Audio(blobUrl);
        audioRef.current = audio;

        // 设置音量
        audio.volume = volume;

        // ---- 事件监听 ----

        // 播放开始
        audio.onplay = () => {
          setIsSpeaking(true);
        };

        // 播放结束
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(blobUrl);
          audioRef.current = null;
          onEnd?.();
        };

        // 播放错误
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(blobUrl);
          audioRef.current = null;
          const errMsg = '音频播放失败';
          setError(errMsg);
          onError?.(errMsg);
        };

        // 开始播放
        await audio.play();
      } catch (err: unknown) {
        // 如果是用户主动取消，不显示错误
        if (err instanceof Error && err.name === 'AbortError') {
          setIsSpeaking(false);
          return;
        }

        const errMsg =
          err instanceof Error ? err.message : '语音合成失败，请重试';
        setError(errMsg);
        setIsSpeaking(false);
        onError?.(errMsg);
      }
    },
    [voice, rate, pitch, volume, stop, onEnd, onError]
  );

  // ---- 组件卸载时清理 ----
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isSpeaking,
    speak,
    stop,
    pause,
    resume,
    error,
    audioElement: audioRef.current,
  };
}

// ============================================================
// Edge-TTS API 调用
// ============================================================

/**
 * 调用 Edge-TTS API 获取音频数据
 *
 * 注意：由于浏览器 CORS 限制，直接调用微软 API 可能失败。
 * 推荐在后端搭建代理服务。此函数为客户端直连方案。
 *
 * @param ssml SSML 格式的语音合成标记
 * @param signal 用于取消请求的 AbortSignal
 * @returns 音频数据的 ArrayBuffer
 */
async function fetchEdgeTTS(
  ssml: string,
  signal: AbortSignal
): Promise<ArrayBuffer> {
  // 生成请求ID和日期
  const requestId = crypto.randomUUID();
  const date = new Date().toUTCString();

  // 构建请求头（模拟 Edge 浏览器）
  const headers: Record<string, string> = {
    Authority: 'speech.platform.bing.com',
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/ssml+xml',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    Pragma: 'no-cache',
    'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
    'X-Edge-Chromium-Version': '130.0.0.0',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.0 Edg/130.0.0.0',
  };

  // 发送请求
  const response = await fetch(EDGE_TTS_STREAM_URL, {
    method: 'POST',
    headers,
    body: ssml.trim(),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Edge-TTS 请求失败: ${response.status} ${response.statusText}`
    );
  }

  return response.arrayBuffer();
}

// ============================================================
// 备用：使用浏览器原生 TTS（Edge-TTS 不可用时降级）
// ============================================================

/**
 * 使用浏览器原生 Web Speech Synthesis API 播放
 * 作为 Edge-TTS 的降级方案
 */
export function useNativeTTS(
  options: TextToSpeechOptions = {}
): UseTextToSpeechReturn {
  const {
    voice,
    rate = DEFAULT_RATE,
    pitch = DEFAULT_PITCH,
    volume = DEFAULT_VOLUME,
    onEnd,
    onError,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 停止播放
  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  // 暂停播放
  const pause = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    setIsSpeaking(false);
  }, []);

  // 恢复播放
  const resume = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsSpeaking(true);
    }
  }, []);

  // 语音合成
  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!text || text.trim().length === 0) {
        const errMsg = '合成文本不能为空';
        setError(errMsg);
        onError?.(errMsg);
        return;
      }

      // 先停止之前的
      stop();
      setError(null);

      try {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          throw new Error('当前浏览器不支持语音合成');
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        // 设置参数
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;
        utterance.lang = 'zh-CN';

        // 查找指定语音
        if (voice) {
          const voices = window.speechSynthesis.getVoices();
          const selectedVoice = voices.find((v) =>
            v.name.toLowerCase().includes(voice.toLowerCase())
          );
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
        }

        // 事件监听
        utterance.onstart = () => {
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          utteranceRef.current = null;
          onEnd?.();
        };

        utterance.onerror = (event) => {
          // 忽略主动取消的错误
          if (event.error === 'canceled') return;

          const errMsg = `语音合成错误: ${event.error}`;
          setIsSpeaking(false);
          setError(errMsg);
          utteranceRef.current = null;
          onError?.(errMsg);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error ? err.message : '语音合成失败，请重试';
        setError(errMsg);
        setIsSpeaking(false);
        onError?.(errMsg);
      }
    },
    [voice, rate, pitch, volume, stop, onEnd, onError]
  );

  // 清理
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isSpeaking,
    speak,
    stop,
    pause,
    resume,
    error,
    audioElement: null,
  };
}

export default useTextToSpeech;

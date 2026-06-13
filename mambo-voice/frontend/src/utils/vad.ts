/**
 * vad.ts
 * 语音活动检测（Voice Activity Detection）模块
 *
 * 基于 Web Audio API 实现实时语音活动检测，
 * 用于判断用户是否还在说话，支持静音超时自动停止录音。
 * 所有参数均可配置，适用于不同噪音环境。
 */

import { VolumeLevel } from './audioProcess';

// ============================================================
// 类型定义
// ============================================================

/** VAD 配置选项 */
export interface VADOptions {
  /** 音频采样率，默认 16000 */
  sampleRate?: number;
  /** FFT 大小，默认 2048 */
  fftSize?: number;
  /** 平滑系数（0~1），默认 0.9 */
  smoothingTimeConstant?: number;
  /** 静音阈值（0~1），默认 0.03 */
  silenceThreshold?: number;
  /** 语音阈值（0~1），默认 0.15 */
  speechThreshold?: number;
  /** 静音超时时间（毫秒），默认 2000 */
  silenceTimeout?: number;
  /** 最小语音持续时间（毫秒），默认 200 */
  minSpeechDuration?: number;
  /** 语音前缓存时间（毫秒），默认 200 */
  preSpeechBufferMs?: number;
  /** 噪音抑制强度（0~1），默认 0.3 */
  noiseReduction?: number;
}

/** VAD 当前状态 */
export enum VADState {
  /** 静音/未检测到语音 */
  SILENT = 'silent',
  /** 检测到语音中 */
  SPEAKING = 'speaking',
  /** 语音暂停中（可能在思考） */
  PAUSED = 'paused',
  /** 检测中 */
  DETECTING = 'detecting',
}

/** VAD 事件回调 */
export interface VADCallbacks {
  /** 检测到语音开始 */
  onSpeechStart?: () => void;
  /** 检测到语音结束 */
  onSpeechEnd?: () => void;
  /** 检测到静音超时 */
  onSilenceTimeout?: () => void;
  /** 音量变化回调 */
  onVolumeChange?: (volume: number, level: VolumeLevel) => void;
  /** 状态变化回调 */
  onStateChange?: (state: VADState) => void;
  /** 音频数据回调（包含前缓存） */
  onAudioData?: (audioData: Float32Array) => void;
}

/** VAD 分析结果 */
export interface VADResult {
  /** 当前状态 */
  state: VADState;
  /** 当前音量（0~1） */
  volume: number;
  /** 是否检测到语音 */
  isSpeech: boolean;
  /** 语音持续时间（毫秒） */
  speechDuration: number;
  /** 静音持续时间（毫秒） */
  silenceDuration: number;
  /** 当前音量等级 */
  volumeLevel: VolumeLevel;
}

/** VAD 统计数据 */
export interface VADStats {
  /** 总检测时长（毫秒） */
  totalDuration: number;
  /** 语音总时长（毫秒） */
  totalSpeechDuration: number;
  /** 语音段数 */
  speechSegments: number;
  /** 平均音量 */
  averageVolume: number;
  /** 最高音量 */
  peakVolume: number;
}

// ============================================================
// 常量
// ============================================================

/** 默认 VAD 配置 */
export const DEFAULT_VAD_OPTIONS: Required<VADOptions> = {
  sampleRate: 16000,
  fftSize: 2048,
  smoothingTimeConstant: 0.9,
  silenceThreshold: 0.03,
  speechThreshold: 0.15,
  silenceTimeout: 2000,
  minSpeechDuration: 200,
  preSpeechBufferMs: 200,
  noiseReduction: 0.3,
};

// ============================================================
// 主 VAD 类
// ============================================================

/**
 * 语音活动检测器（Voice Activity Detector）
 *
 * 基于 Web Audio API 实现，能够实时分析音频流，
 * 检测语音的开始和结束，支持静音超时自动停止。
 *
 * @example
 * ```ts
 * const vad = new VoiceActivityDetector({
 *   silenceThreshold: 0.02,
 *   silenceTimeout: 1500,
 * });
 *
 * vad.connect(microphoneStream, {
 *   onSpeechStart: () => console.log('开始说话'),
 *   onSpeechEnd: () => console.log('停止说话'),
 *   onSilenceTimeout: () => console.log('静音超时，停止录音'),
 * });
 * ```
 */
export class VoiceActivityDetector {
  /** 当前配置 */
  private options: Required<VADOptions>;
  /** 音频上下文 */
  private audioContext: AudioContext | null = null;
  /** 分析器节点 */
  private analyser: AnalyserNode | null = null;
  /** 音频源节点 */
  private source: MediaStreamAudioSourceNode | null = null;
  /** 脚本处理器节点（备用方案） */
  private scriptProcessor: ScriptProcessorNode | null = null;
  /** 事件回调 */
  private callbacks: VADCallbacks = {};

  // ---- 状态跟踪 ----
  private currentState: VADState = VADState.SILENT;
  private isRunning = false;
  private isSpeechDetected = false;
  private speechStartTime = 0;
  private silenceStartTime = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private animationFrameId: number | null = null;

  // ---- 前缓存（用于捕获语音开始前的音频） ----
  private _preSpeechBuffer: Float32Array[] = [];
  private _maxBufferSize: number;

  // ---- 统计数据 ----
  private stats: {
    totalStartTime: number;
    totalSpeechDuration: number;
    speechSegments: number;
    volumeSum: number;
    volumeCount: number;
    peakVolume: number;
  };

  // ---- 音量平滑处理 ----
  private smoothedVolume = 0;

  /**
   * 创建语音活动检测器
   * @param options VAD 配置选项
   */
  constructor(options: VADOptions = {}) {
    this.options = { ...DEFAULT_VAD_OPTIONS, ...options };

    // 计算前缓存大小（采样数）
    this._maxBufferSize = Math.ceil(
      (this.options.preSpeechBufferMs / 1000) * this.options.sampleRate
    );

    // 初始化统计数据
    this.stats = {
      totalStartTime: 0,
      totalSpeechDuration: 0,
      speechSegments: 0,
      volumeSum: 0,
      volumeCount: 0,
      peakVolume: 0,
    };
  }

  // ==========================================================
  // 公共方法
  // ==========================================================

  /**
   * 连接音频源并开始检测
   * @param stream 媒体流（麦克风输入等）
   * @param callbacks 事件回调函数
   * @param audioContext 可选的音频上下文
   */
  connect(
    stream: MediaStream,
    callbacks: VADCallbacks = {},
    audioContext?: AudioContext
  ): void {
    if (this.isRunning) {
      this.disconnect();
    }

    this.callbacks = callbacks;
    this.isRunning = true;

    // 创建或复用音频上下文
    this.audioContext =
      audioContext ||
      new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.options.sampleRate,
      });

    // 创建分析器节点
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.options.fftSize;
    this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;

    // 创建媒体源节点
    this.source = this.audioContext.createMediaStreamSource(stream);

    // 连接节点：source -> analyser
    this.source.connect(this.analyser);

    // 重置状态
    this.currentState = VADState.DETECTING;
    this.isSpeechDetected = false;
    this.speechStartTime = 0;
    this.silenceStartTime = 0;
    this.smoothedVolume = 0;
    this._preSpeechBuffer = [];

    // 重置统计数据
    this.stats = {
      totalStartTime: Date.now(),
      totalSpeechDuration: 0,
      speechSegments: 0,
      volumeSum: 0,
      volumeCount: 0,
      peakVolume: 0,
    };

    // 启动分析循环
    this.startAnalysisLoop();

    // 触发状态变化
    this.emitStateChange(VADState.DETECTING);
  }

  /**
   * 断开连接，停止检测
   */
  disconnect(): void {
    this.isRunning = false;

    // 取消动画帧
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 清除静音定时器
    this.clearSilenceTimer();

    // 断开节点连接
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // 忽略断开错误
      }
      this.source = null;
    }

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {
        // 忽略断开错误
      }
      this.scriptProcessor = null;
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // 忽略断开错误
      }
      this.analyser = null;
    }

    // 更新状态
    if (this.currentState !== VADState.SILENT) {
      this.currentState = VADState.SILENT;
      this.emitStateChange(VADState.SILENT);
    }
  }

  /**
   * 销毁检测器，释放所有资源
   */
  destroy(): void {
    this.disconnect();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.callbacks = {};
  }

  /**
   * 获取当前检测结果
   */
  getResult(): VADResult {
    const now = Date.now();
    const speechDuration = this.isSpeechDetected
      ? now - this.speechStartTime
      : 0;
    const silenceDuration = this.silenceStartTime > 0
      ? now - this.silenceStartTime
      : 0;

    return {
      state: this.currentState,
      volume: this.smoothedVolume,
      isSpeech: this.isSpeechDetected,
      speechDuration,
      silenceDuration,
      volumeLevel: this.getVolumeLevel(this.smoothedVolume),
    };
  }

  /**
   * 获取统计数据
   */
  getStats(): VADStats {
    const now = Date.now();
    const totalDuration = this.stats.totalStartTime > 0
      ? now - this.stats.totalStartTime
      : 0;

    return {
      totalDuration,
      totalSpeechDuration: this.stats.totalSpeechDuration,
      speechSegments: this.stats.speechSegments,
      averageVolume:
        this.stats.volumeCount > 0
          ? this.stats.volumeSum / this.stats.volumeCount
          : 0,
      peakVolume: this.stats.peakVolume,
    };
  }

  /**
   * 获取当前状态
   */
  getState(): VADState {
    return this.currentState;
  }

  /**
   * 是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 重置统计数据
   */
  resetStats(): void {
    this.stats = {
      totalStartTime: Date.now(),
      totalSpeechDuration: 0,
      speechSegments: 0,
      volumeSum: 0,
      volumeCount: 0,
      peakVolume: 0,
    };
  }

  /**
   * 更新配置（运行时动态调整）
   * @param newOptions 新的配置选项
   */
  updateOptions(newOptions: Partial<VADOptions>): void {
    this.options = { ...this.options, ...newOptions };

    // 如果分析器存在，更新其参数
    if (this.analyser) {
      if (newOptions.fftSize !== undefined) {
        this.analyser.fftSize = newOptions.fftSize;
      }
      if (newOptions.smoothingTimeConstant !== undefined) {
        this.analyser.smoothingTimeConstant = newOptions.smoothingTimeConstant;
      }
    }
  }

  // ==========================================================
  // 私有方法 - 核心分析逻辑
  // ==========================================================

  /**
   * 启动实时分析循环（使用 requestAnimationFrame）
   */
  private startAnalysisLoop(): void {
    const analyser = this.analyser!;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const bufferLength = dataArray.length;

    const analyze = () => {
      if (!this.isRunning) return;

      // 获取时域数据
      analyser.getByteTimeDomainData(dataArray);

      // 计算音量
      const volume = this.calculateVolume(dataArray, bufferLength);

      // 更新平滑音量
      this.smoothedVolume =
        this.smoothedVolume * this.options.smoothingTimeConstant +
        volume * (1 - this.options.smoothingTimeConstant);

      // 更新统计数据
      this.updateStats(this.smoothedVolume);

      // 音量回调
      this.callbacks.onVolumeChange?.(
        this.smoothedVolume,
        this.getVolumeLevel(this.smoothedVolume)
      );

      // 语音活动检测逻辑
      this.processVADLogic(this.smoothedVolume);

      // 继续下一帧
      this.animationFrameId = requestAnimationFrame(analyze);
    };

    this.animationFrameId = requestAnimationFrame(analyze);
  }

  /**
   * 计算音量值（从时域数据）
   */
  private calculateVolume(
    dataArray: Uint8Array,
    bufferLength: number
  ): number {
    let sum = 0;
    let maxVal = 0;

    for (let i = 0; i < bufferLength; i++) {
      // 将 0~255 转换为 -1~1
      const x = (dataArray[i] - 128) / 128;
      sum += x * x;
      maxVal = Math.max(maxVal, Math.abs(x));
    }

    // 均方根值
    const rms = Math.sqrt(sum / bufferLength);

    // 应用噪音抑制
    const noiseFloor = this.options.noiseReduction * 0.1;
    const adjustedRms = Math.max(0, rms - noiseFloor);

    // 归一化到 0~1
    return Math.min(1, adjustedRms * 4);
  }

  /**
   * VAD 核心逻辑处理
   */
  private processVADLogic(volume: number): void {
    const now = Date.now();

    if (this.isSpeechDetected) {
      // ---- 当前处于语音状态 ----
      if (volume < this.options.silenceThreshold) {
        // 检测到静音
        if (this.silenceStartTime === 0) {
          this.silenceStartTime = now;
        }

        const silenceDuration = now - this.silenceStartTime;

        // 切换到暂停状态
        if (
          this.currentState === VADState.SPEAKING &&
          silenceDuration > 200
        ) {
          this.currentState = VADState.PAUSED;
          this.emitStateChange(VADState.PAUSED);
        }

        // 静音超时
        if (silenceDuration >= this.options.silenceTimeout) {
          this.endSpeechDetection(now);
          this.callbacks.onSilenceTimeout?.();
        }
      } else {
        // 语音继续，重置静音计时
        this.silenceStartTime = 0;

        if (this.currentState !== VADState.SPEAKING) {
          this.currentState = VADState.SPEAKING;
          this.emitStateChange(VADState.SPEAKING);
        }
      }
    } else {
      // ---- 当前处于静音状态 ----
      if (volume >= this.options.speechThreshold) {
        // 检测到语音
        this.startSpeechDetection(now);
      }
    }
  }

  /**
   * 开始语音检测
   */
  private startSpeechDetection(now: number): void {
    this.isSpeechDetected = true;
    this.speechStartTime = now;
    this.silenceStartTime = 0;
    this.currentState = VADState.SPEAKING;

    // 更新统计
    this.stats.speechSegments++;

    // 触发回调
    this.emitStateChange(VADState.SPEAKING);
    this.callbacks.onSpeechStart?.();
  }

  /**
   * 结束语音检测
   */
  private endSpeechDetection(now: number): void {
    const speechDuration = now - this.speechStartTime;

    // 检查最小语音持续时间
    if (speechDuration >= this.options.minSpeechDuration) {
      this.stats.totalSpeechDuration += speechDuration;
      this.callbacks.onSpeechEnd?.();
    }

    this.isSpeechDetected = false;
    this.speechStartTime = 0;
    this.silenceStartTime = 0;
    this.currentState = VADState.SILENT;
    this.clearSilenceTimer();
    this._preSpeechBuffer = [];

    this.emitStateChange(VADState.SILENT);
  }

  /**
   * 更新统计数据
   */
  private updateStats(volume: number): void {
    this.stats.volumeSum += volume;
    this.stats.volumeCount++;
    this.stats.peakVolume = Math.max(this.stats.peakVolume, volume);
  }

  /**
   * 获取音量等级
   */
  private getVolumeLevel(volume: number): VolumeLevel {
    if (volume < 0.02) return VolumeLevel.SILENT;
    if (volume < 0.1) return VolumeLevel.LOW;
    if (volume < 0.3) return VolumeLevel.MEDIUM;
    if (volume < 0.6) return VolumeLevel.HIGH;
    return VolumeLevel.VERY_HIGH;
  }

  /**
   * 清除静音定时器
   */
  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * 触发状态变化回调
   */
  private emitStateChange(state: VADState): void {
    this.callbacks.onStateChange?.(state);
  }
}

// ============================================================
// 便捷 Hook 包装（用于 React）
// ============================================================

/**
 * 创建并管理 VoiceActivityDetector 实例
 * 适用于 React 组件中使用
 *
 * @example
 * ```ts
 * const { detector, connect, disconnect, result } = createVADInstance({
 *   silenceTimeout: 2000,
 * });
 *
 * // 在组件中使用
 * useEffect(() => {
 *   if (stream) {
 *     connect(stream, {
 *       onSpeechStart: () => setIsSpeaking(true),
 *       onSpeechEnd: () => setIsSpeaking(false),
 *       onSilenceTimeout: () => stopRecording(),
 *     });
 *   }
 *   return () => disconnect();
 * }, [stream]);
 * ```
 */
export function createVADInstance(options: VADOptions = {}) {
  const detector = new VoiceActivityDetector(options);

  return {
    detector,
    /**
     * 连接音频源
     */
    connect: (
      stream: MediaStream,
      callbacks?: VADCallbacks,
      audioContext?: AudioContext
    ) => {
      detector.connect(stream, callbacks, audioContext);
    },
    /**
     * 断开连接
     */
    disconnect: () => {
      detector.disconnect();
    },
    /**
     * 销毁实例
     */
    destroy: () => {
      detector.destroy();
    },
    /**
     * 获取当前结果
     */
    getResult: (): VADResult => detector.getResult(),
    /**
     * 获取统计数据
     */
    getStats: (): VADStats => detector.getStats(),
    /**
     * 是否正在运行
     */
    isActive: (): boolean => detector.isActive(),
  };
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 从音频缓冲区执行简单的 VAD 分析
 * 适用于对已录制的音频进行离线分析
 *
 * @param audioBuffer 音频缓冲区
 * @param options VAD 配置选项
 * @returns 语音段的时间范围数组
 */
export function analyzeAudioBufferVAD(
  audioBuffer: AudioBuffer,
  options: Partial<VADOptions> = {}
): Array<{ start: number; end: number; volume: number }> {
  const opts = { ...DEFAULT_VAD_OPTIONS, ...options };
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;

  // 计算每帧的采样数（20ms 一帧）
  const frameSize = Math.floor((opts.sampleRate * 20) / 1000); // 20ms
  const hopSize = Math.floor(frameSize / 2); // 50% 重叠
  const numFrames = Math.floor((totalSamples - frameSize) / hopSize) + 1;

  const frames: Array<{ volume: number; isSpeech: boolean }> = [];

  // 分析每一帧
  for (let i = 0; i < numFrames; i++) {
    const startSample = i * hopSize;
    let sum = 0;

    for (let j = 0; j < frameSize; j++) {
      sum += channelData[startSample + j] * channelData[startSample + j];
    }

    const rms = Math.sqrt(sum / frameSize);
    const normalizedVolume = Math.min(1, rms * 4);

    frames.push({
      volume: normalizedVolume,
      isSpeech: normalizedVolume >= opts.speechThreshold,
    });
  }

  // 合并连续的语音段
  const speechSegments: Array<{ start: number; end: number; volume: number }> =
    [];
  let segmentStart: number | null = null;
  let segmentVolumeSum = 0;
  let segmentFrameCount = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const timeMs = Math.floor(((i * hopSize) / sampleRate) * 1000);

    if (frame.isSpeech && segmentStart === null) {
      // 语音段开始
      segmentStart = timeMs;
      segmentVolumeSum = frame.volume;
      segmentFrameCount = 1;
    } else if (frame.isSpeech && segmentStart !== null) {
      // 语音段继续
      segmentVolumeSum += frame.volume;
      segmentFrameCount++;
    } else if (!frame.isSpeech && segmentStart !== null) {
      // 语音段结束
      const duration = timeMs - segmentStart;
      if (duration >= opts.minSpeechDuration) {
        speechSegments.push({
          start: segmentStart,
          end: timeMs,
          volume: segmentVolumeSum / segmentFrameCount,
        });
      }
      segmentStart = null;
      segmentVolumeSum = 0;
      segmentFrameCount = 0;
    }
  }

  // 处理末尾的语音段
  if (segmentStart !== null) {
    const endTimeMs = Math.floor((totalSamples / sampleRate) * 1000);
    const duration = endTimeMs - segmentStart;
    if (duration >= opts.minSpeechDuration) {
      speechSegments.push({
        start: segmentStart,
        end: endTimeMs,
        volume: segmentVolumeSum / segmentFrameCount,
      });
    }
  }

  return speechSegments;
}

/**
 * 检测环境噪音水平
 * 在正式开始语音识别前，先测量环境噪音以动态调整阈值
 *
 * @param stream 媒体流
 * @param durationMs 测量时长（毫秒），默认 1000
 * @returns 噪音水平（0~1）
 */
export async function measureAmbientNoise(
  stream: MediaStream,
  durationMs: number = 1000
): Promise<number> {
  return new Promise((resolve) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.9;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const samples: number[] = [];
    let sampleCount = 0;
    const maxSamples = Math.floor(durationMs / 50); // 每 50ms 采样一次

    const measure = () => {
      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const x = (dataArray[i] - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      samples.push(rms);
      sampleCount++;

      if (sampleCount < maxSamples) {
        setTimeout(measure, 50);
      } else {
        // 计算平均噪音水平（排除异常值）
        samples.sort((a, b) => a - b);
        const trimmedSamples = samples.slice(
          Math.floor(samples.length * 0.2),
          Math.floor(samples.length * 0.8)
        );
        const avgNoise =
          trimmedSamples.reduce((a, b) => a + b, 0) / trimmedSamples.length;

        // 清理资源
        source.disconnect();
        analyser.disconnect();
        audioContext.close();

        resolve(avgNoise * 4); // 归一化
      }
    };

    measure();
  });
}

/**
 * 根据环境噪音自动推荐 VAD 配置
 *
 * @param noiseLevel 测量的环境噪音水平（0~1）
 * @returns 推荐的 VAD 配置
 */
export function getRecommendedVADConfig(
  noiseLevel: number
): Required<VADOptions> {
  const config = { ...DEFAULT_VAD_OPTIONS };

  if (noiseLevel < 0.05) {
    // 安静环境
    config.silenceThreshold = 0.02;
    config.speechThreshold = 0.1;
    config.noiseReduction = 0.1;
  } else if (noiseLevel < 0.15) {
    // 一般环境
    config.silenceThreshold = 0.03;
    config.speechThreshold = 0.15;
    config.noiseReduction = 0.3;
  } else if (noiseLevel < 0.3) {
    // 嘈杂环境
    config.silenceThreshold = 0.05;
    config.speechThreshold = 0.2;
    config.noiseReduction = 0.5;
  } else {
    // 非常嘈杂的环境
    config.silenceThreshold = 0.08;
    config.speechThreshold = 0.25;
    config.noiseReduction = 0.7;
  }

  return config;
}

export default {
  VoiceActivityDetector,
  createVADInstance,
  analyzeAudioBufferVAD,
  measureAmbientNoise,
  getRecommendedVADConfig,
  VADState,
  DEFAULT_VAD_OPTIONS,
};

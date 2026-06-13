/**
 * audioProcess.ts
 * 音频处理工具模块
 *
 * 提供音量检测、音频格式转换、音频时长计算、波形生成等
 * 音频处理基础功能，支持语音助手场景下的音频分析需求。
 */

// ============================================================
// 类型定义
// ============================================================

/** 音量分析结果 */
export interface VolumeAnalysisResult {
  /** 当前音量值（0 ~ 1，标准化） */
  volume: number;
  /** 原始音量值 */
  rawVolume: number;
  /** 是否为静音 */
  isSilent: boolean;
  /** 音量分贝值（估算） */
  decibels: number;
  /** 音量等级 */
  level: VolumeLevel;
}

/** 音量等级枚举 */
export enum VolumeLevel {
  SILENT = 'silent',     // 静音
  LOW = 'low',           // 低
  MEDIUM = 'medium',     // 中
  HIGH = 'high',         // 高
  VERY_HIGH = 'very_high', // 很高
}

/** 音频格式类型 */
export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'webm' | 'aac';

/** 音频信息 */
export interface AudioInfo {
  /** 时长（毫秒） */
  duration: number;
  /** 采样率 */
  sampleRate: number;
  /** 声道数 */
  channels: number;
  /** 比特率（估算） */
  bitrate: number;
  /** 文件大小（字节） */
  size: number;
}

/** 音频格式转换选项 */
export interface ConvertOptions {
  /** 目标格式 */
  format: AudioFormat;
  /** 采样率，默认 16000 */
  sampleRate?: number;
  /** 声道数，默认 1 */
  channels?: number;
  /** 比特率，默认 128000 */
  bitrate?: number;
}

/** 音频片段 */
export interface AudioSlice {
  /** 开始时间（毫秒） */
  start: number;
  /** 结束时间（毫秒） */
  end: number;
  /** 音频数据 */
  buffer: AudioBuffer;
}

// ============================================================
// 音量检测相关常量
// ============================================================

/** 静音阈值（标准化后的音量值） */
export const SILENCE_THRESHOLD = 0.02;

/** 音量等级阈值 */
export const VOLUME_LEVELS = {
  [VolumeLevel.SILENT]: { min: 0, max: 0.02 },
  [VolumeLevel.LOW]: { min: 0.02, max: 0.1 },
  [VolumeLevel.MEDIUM]: { min: 0.1, max: 0.3 },
  [VolumeLevel.HIGH]: { min: 0.3, max: 0.6 },
  [VolumeLevel.VERY_HIGH]: { min: 0.6, max: 1.0 },
};

/** 默认音频上下文配置 */
export const DEFAULT_AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  bufferSize: 2048,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
};

// ============================================================
// 音量检测
// ============================================================

/**
 * 分析音频缓冲区的音量
 *
 * 计算音频数据的均方根(RMS)值作为音量指标，
 * 返回标准化的音量值（0 ~ 1）和音量等级。
 *
 * @param audioBuffer 音频缓冲区
 * @param channel 声道索引，默认 0
 * @returns 音量分析结果
 *
 * @example
 * ```ts
 * const result = analyzeVolume(audioBuffer);
 * console.log(result.volume); // 0.35
 * console.log(result.level);  // 'medium'
 * ```
 */
export function analyzeVolume(
  audioBuffer: AudioBuffer,
  channel: number = 0
): VolumeAnalysisResult {
  const data = audioBuffer.getChannelData(channel);
  const length = data.length;

  if (length === 0) {
    return {
      volume: 0,
      rawVolume: 0,
      isSilent: true,
      decibels: -Infinity,
      level: VolumeLevel.SILENT,
    };
  }

  // 计算均方根值（RMS - Root Mean Square）
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += data[i] * data[i];
  }
  const rms = Math.sqrt(sum / length);

  // 标准化音量值（使用对数缩放使结果更自然）
  const normalizedVolume = Math.min(1, Math.max(0, rms * 4));

  // 估算分贝值（以最大振幅为 0dB 参考）
  const decibels = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

  // 判断音量等级
  const level = getVolumeLevel(normalizedVolume);

  return {
    volume: normalizedVolume,
    rawVolume: rms,
    isSilent: normalizedVolume < SILENCE_THRESHOLD,
    decibels,
    level,
  };
}

/**
 * 实时音量检测器
 *
 * 使用 Web Audio API 的 AnalyserNode 进行实时音量检测，
 * 适用于麦克风输入流的实时音量监控。
 */
export class RealtimeVolumeDetector {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRunning = false;

  /**
   * 创建实时音量检测器
   * @param audioContext 可选的音频上下文，如果不传则自动创建
   */
  constructor(audioContext?: AudioContext) {
    this.audioContext = audioContext || new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = DEFAULT_AUDIO_CONFIG.fftSize;
    this.analyser.smoothingTimeConstant =
      DEFAULT_AUDIO_CONFIG.smoothingTimeConstant;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
  }

  /**
   * 连接音频源并开始检测
   * @param stream 媒体流（如麦克风输入）
   */
  connect(stream: MediaStream): void {
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.isRunning = true;
  }

  /**
   * 获取当前音量
   * @returns 音量分析结果
   */
  getVolume(): VolumeAnalysisResult {
    if (!this.isRunning) {
      return {
        volume: 0,
        rawVolume: 0,
        isSilent: true,
        decibels: -Infinity,
        level: VolumeLevel.SILENT,
      };
    }

    // 获取时域数据
    this.analyser.getByteTimeDomainData(this.dataArray as any);

    // 计算 RMS 值
    let sum = 0;
    const length = this.dataArray.length;
    for (let i = 0; i < length; i++) {
      // 将 0~255 转换为 -1~1
      const normalized = (this.dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / length);

    // 标准化音量值
    const normalizedVolume = Math.min(1, Math.max(0, rms * 3));
    const decibels = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

    return {
      volume: normalizedVolume,
      rawVolume: rms,
      isSilent: normalizedVolume < SILENCE_THRESHOLD,
      decibels,
      level: getVolumeLevel(normalizedVolume),
    };
  }

  /**
   * 获取频域数据（用于可视化）
   * @returns 频域数据数组
   */
  getFrequencyData(): Uint8Array {
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);
    return frequencyData;
  }

  /**
   * 断开连接并释放资源
   */
  disconnect(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    this.isRunning = false;
  }

  /**
   * 销毁检测器
   */
  destroy(): void {
    this.disconnect();
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

/**
 * 获取音量等级
 * @param volume 标准化音量值（0 ~ 1）
 * @returns 音量等级
 */
function getVolumeLevel(volume: number): VolumeLevel {
  if (volume < VOLUME_LEVELS[VolumeLevel.LOW].max) return VolumeLevel.LOW;
  if (volume < VOLUME_LEVELS[VolumeLevel.MEDIUM].max)
    return VolumeLevel.MEDIUM;
  if (volume < VOLUME_LEVELS[VolumeLevel.HIGH].max) return VolumeLevel.HIGH;
  return VolumeLevel.VERY_HIGH;
}

// ============================================================
// 音频格式转换
// ============================================================

/**
 * 将音频缓冲区转换为 WAV 格式 Blob
 *
 * @param audioBuffer 音频缓冲区
 * @returns WAV 格式的 Blob 对象
 *
 * @example
 * ```ts
 * const wavBlob = audioBufferToWav(audioBuffer);
 * const url = URL.createObjectURL(wavBlob);
 * ```
 */
export function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  // 合并所有声道的数据
  const channelData: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i));
  }

  const length = audioBuffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  // WAV 文件头 + 数据
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // 写入 WAV 文件头
  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // chunk size
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, format, true); // audio format (PCM)
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // 写入音频数据（转换为 16 位整数）
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      // 将 -1~1 转换为 16 位有符号整数
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * 将音频缓冲区转换为指定的格式 Blob
 * （使用 MediaRecorder API 进行编码）
 *
 * @param audioBuffer 音频缓冲区
 * @param options 转换选项
 * @returns 转换后的 Blob 对象
 */
export async function convertAudioFormat(
  audioBuffer: AudioBuffer,
  options: ConvertOptions
): Promise<Blob> {
  const { format, sampleRate = 16000, channels = 1 } = options;

  // 如果是 WAV 格式，使用内部实现
  if (format === 'wav') {
    return audioBufferToWav(audioBuffer);
  }

  // 其他格式使用 MediaRecorder
  const mimeType = getMimeType(format);
  if (!mimeType || !MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error(`不支持的音频格式: ${format}`);
  }

  // 创建音频上下文和离线上下文进行重采样
  const offlineContext = new OfflineAudioContext(
    channels,
    Math.ceil(
      (audioBuffer.duration * sampleRate * channels) / audioBuffer.numberOfChannels
    ),
    sampleRate
  );

  // 创建源节点
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();

  // 渲染
  const renderedBuffer = await offlineContext.startRendering();

  // 使用 MediaRecorder 录制为指定格式
  return new Promise((resolve, reject) => {
    const streamDestination =
      new (window.AudioContext || window.webkitAudioContext)().createMediaStreamDestination();
    const recorder = new MediaRecorder(streamDestination.stream, {
      mimeType,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };

    recorder.onerror = () => {
      reject(new Error('音频编码失败'));
    };

    recorder.start();

    // 播放音频到 MediaStream
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playSource = ctx.createBufferSource();
    playSource.buffer = renderedBuffer;
    playSource.connect(ctx.destination);
    playSource.connect(streamDestination);
    playSource.start();

    playSource.onended = () => {
      recorder.stop();
    };
  });
}

/**
 * 将 Blob/ArrayBuffer 解码为 AudioBuffer
 *
 * @param audioData 音频数据
 * @returns 解码后的 AudioBuffer
 */
export async function decodeAudioData(
  audioData: Blob | ArrayBuffer
): Promise<AudioBuffer> {
  const arrayBuffer =
    audioData instanceof Blob ? await audioData.arrayBuffer() : audioData;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return audioContext.decodeAudioData(arrayBuffer);
}

// ============================================================
// 音频时长计算
// ============================================================

/**
 * 计算音频时长（毫秒）
 *
 * @param audioBuffer 音频缓冲区
 * @returns 时长（毫秒）
 */
export function getAudioDuration(audioBuffer: AudioBuffer): number {
  return Math.round(audioBuffer.duration * 1000);
}

/**
 * 从音频文件(Blob)获取音频信息
 *
 * @param blob 音频文件 Blob
 * @returns 音频信息
 */
export async function getAudioInfo(blob: Blob): Promise<AudioInfo> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await decodeAudioData(arrayBuffer);

  // 估算比特率
  const bitrate = Math.round(
    (blob.size * 8) / audioBuffer.duration
  );

  return {
    duration: getAudioDuration(audioBuffer),
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    bitrate,
    size: blob.size,
  };
}

/**
 * 格式化时长显示
 *
 * @param milliseconds 毫秒数
 * @returns 格式化后的时间字符串，如 "01:30"
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// 音频分割与合并
// ============================================================

/**
 * 按时间范围切割音频
 *
 * @param audioBuffer 原始音频缓冲区
 * @param startMs 开始时间（毫秒）
 * @param endMs 结束时间（毫秒）
 * @returns 切割后的音频片段
 */
export function sliceAudio(
  audioBuffer: AudioBuffer,
  startMs: number,
  endMs: number
): AudioSlice {
  const startSample = Math.floor((startMs / 1000) * audioBuffer.sampleRate);
  const endSample = Math.floor((endMs / 1000) * audioBuffer.sampleRate);
  const length = endSample - startSample;

  const newBuffer = new AudioContext().createBuffer(
    audioBuffer.numberOfChannels,
    length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      newData[i] = oldData[startSample + i];
    }
  }

  return {
    start: startMs,
    end: endMs,
    buffer: newBuffer,
  };
}

/**
 * 检测音频中的静音段
 *
 * @param audioBuffer 音频缓冲区
 * @param threshold 静音阈值（默认 0.02）
 * @param minDurationMs 最小静音时长（毫秒），默认 200
 * @returns 静音段的时间范围数组
 */
export function detectSilenceSegments(
  audioBuffer: AudioBuffer,
  threshold: number = SILENCE_THRESHOLD,
  minDurationMs: number = 200
): Array<{ start: number; end: number }> {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0); // 使用第一声道
  const totalSamples = data.length;
  const minSilenceSamples = Math.floor((minDurationMs / 1000) * sampleRate);

  const silenceSegments: Array<{ start: number; end: number }> = [];
  let silenceStart: number | null = null;

  for (let i = 0; i < totalSamples; i++) {
    const isSilent = Math.abs(data[i]) < threshold;

    if (isSilent && silenceStart === null) {
      // 静音开始
      silenceStart = i;
    } else if (!isSilent && silenceStart !== null) {
      // 静音结束
      const silenceLength = i - silenceStart;
      if (silenceLength >= minSilenceSamples) {
        silenceSegments.push({
          start: Math.floor((silenceStart / sampleRate) * 1000),
          end: Math.floor((i / sampleRate) * 1000),
        });
      }
      silenceStart = null;
    }
  }

  // 处理末尾的静音段
  if (silenceStart !== null) {
    const silenceLength = totalSamples - silenceStart;
    if (silenceLength >= minSilenceSamples) {
      silenceSegments.push({
        start: Math.floor((silenceStart / sampleRate) * 1000),
        end: Math.floor((totalSamples / sampleRate) * 1000),
      });
    }
  }

  return silenceSegments;
}

// ============================================================
// 音频预处理（用于语音识别优化）
// ============================================================

/**
 * 对音频进行降噪预处理
 *
 * 使用简单的阈值降噪算法，适用于语音增强。
 * 注意：此方法为基础降噪，如需更高质量请使用专门的降噪库。
 *
 * @param audioBuffer 原始音频缓冲区
 * @param noiseThreshold 噪声阈值（默认 0.01）
 * @returns 降噪后的音频缓冲区
 */
export function denoiseAudio(
  audioBuffer: AudioBuffer,
  noiseThreshold: number = 0.01
): AudioBuffer {
  const newBuffer = new AudioContext().createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    for (let i = 0; i < oldData.length; i++) {
      // 简单的阈值降噪：低于阈值的采样点置零
      newData[i] = Math.abs(oldData[i]) < noiseThreshold ? 0 : oldData[i];
    }
  }

  return newBuffer;
}

/**
 * 归一化音频音量
 *
 * 将音频的峰值调整到目标水平，使音量一致。
 *
 * @param audioBuffer 音频缓冲区
 * @param targetPeak 目标峰值（默认 0.9）
 * @returns 归一化后的音频缓冲区
 */
export function normalizeAudio(
  audioBuffer: AudioBuffer,
  targetPeak: number = 0.9
): AudioBuffer {
  // 找到当前峰值
  let currentPeak = 0;
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      currentPeak = Math.max(currentPeak, Math.abs(data[i]));
    }
  }

  if (currentPeak === 0) return audioBuffer; // 全是静音

  // 计算增益
  const gain = targetPeak / currentPeak;

  const newBuffer = new AudioContext().createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    for (let i = 0; i < oldData.length; i++) {
      newData[i] = oldData[i] * gain;
    }
  }

  return newBuffer;
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取音频格式对应的 MIME 类型
 * @param format 音频格式
 * @returns MIME 类型字符串
 */
function getMimeType(format: AudioFormat): string {
  const mimeTypes: Record<AudioFormat, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    aac: 'audio/aac',
  };
  return mimeTypes[format];
}

/**
 * 向 DataView 写入字符串
 * @param view DataView 对象
 * @param offset 偏移量
 * @param str 要写入的字符串
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export default {
  analyzeVolume,
  RealtimeVolumeDetector,
  audioBufferToWav,
  convertAudioFormat,
  decodeAudioData,
  getAudioDuration,
  getAudioInfo,
  formatDuration,
  sliceAudio,
  detectSilenceSegments,
  denoiseAudio,
  normalizeAudio,
};

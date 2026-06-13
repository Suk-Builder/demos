/**
 * utils/index.ts
 * 工具模块导出
 */

export {
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
  SILENCE_THRESHOLD,
  VOLUME_LEVELS,
  DEFAULT_AUDIO_CONFIG,
} from './audioProcess';

export type {
  VolumeAnalysisResult,
  AudioFormat,
  AudioInfo,
  ConvertOptions,
  AudioSlice,
} from './audioProcess';
export { VolumeLevel } from './audioProcess';

export {
  VoiceActivityDetector,
  createVADInstance,
  analyzeAudioBufferVAD,
  measureAmbientNoise,
  getRecommendedVADConfig,
  DEFAULT_VAD_OPTIONS,
  VADState,
} from './vad';

export type {
  VADOptions,
  VADResult,
  VADStats,
  VADCallbacks,
} from './vad';

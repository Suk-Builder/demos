/**
 * types/speech.ts
 * 语音模块的共享类型定义
 *
 * 集中定义语音助手相关的 TypeScript 类型，
 * 确保各模块间类型一致性。
 */

// ============================================================
// 语音识别相关类型
// ============================================================

/** 语音识别配置 */
export interface SpeechRecognitionConfig {
  /** 识别语言，默认 zh-CN */
  lang: string;
  /** 是否连续识别 */
  continuous: boolean;
  /** 是否返回临时结果 */
  interimResults: boolean;
  /** 最大备选结果数 */
  maxAlternatives: number;
  /** 静音超时时间（毫秒） */
  silenceTimeout: number;
}

/** 语音识别结果 */
export interface SpeechRecognitionResult {
  /** 最终识别文本 */
  transcript: string;
  /** 临时识别文本 */
  interimTranscript: string;
  /** 置信度（0~1） */
  confidence: number;
  /** 是否最终结果 */
  isFinal: boolean;
}

/** 语音识别错误类型 */
export type SpeechRecognitionError =
  | 'noSpeech'
  | 'audioCapture'
  | 'notAllowed'
  | 'network'
  | 'aborted'
  | 'languageNotSupported'
  | 'badGrammar'
  | 'serviceNotAllowed'
  | 'unknown';

/** 语音识别事件 */
export interface SpeechRecognitionEventMap {
  result: SpeechRecognitionResult;
  error: { error: SpeechRecognitionError; message: string };
  start: void;
  end: void;
  nomatch: void;
}

// ============================================================
// 语音合成相关类型
// ============================================================

/** 语音合成配置 */
export interface TextToSpeechConfig {
  /** 语音名称 */
  voice: string;
  /** 语速（0.5~2.0） */
  rate: number;
  /** 音调（0.5~2.0） */
  pitch: number;
  /** 音量（0~1） */
  volume: number;
}

/** Edge-TTS 支持的语音列表 */
export const EDGE_TTS_VOICES = {
  // 中文
  'zh-CN-XiaoxiaoNeural': { name: '晓晓', gender: 'female', locale: 'zh-CN' },
  'zh-CN-XiaoyiNeural': { name: '晓伊', gender: 'female', locale: 'zh-CN' },
  'zh-CN-YunjianNeural': { name: '云健', gender: 'male', locale: 'zh-CN' },
  'zh-CN-YunxiNeural': { name: '云希', gender: 'male', locale: 'zh-CN' },
  'zh-CN-YunxiaNeural': { name: '云夏', gender: 'male', locale: 'zh-CN' },
  'zh-CN-YunyangNeural': { name: '云扬', gender: 'male', locale: 'zh-CN' },
  'zh-CN-liaoning-XiaobeiNeural': {
    name: '晓北',
    gender: 'female',
    locale: 'zh-CN-liaoning',
  },
  'zh-TW-HsiaoChenNeural': {
    name: '晓陈',
    gender: 'female',
    locale: 'zh-TW',
  },
  // 英语
  'en-US-AriaNeural': { name: 'Aria', gender: 'female', locale: 'en-US' },
  'en-US-GuyNeural': { name: 'Guy', gender: 'male', locale: 'en-US' },
  // 日语
  'ja-JP-NanamiNeural': { name: '七海', gender: 'female', locale: 'ja-JP' },
  // 韩语
  'ko-KR-SunHiNeural': { name: '善熙', gender: 'female', locale: 'ko-KR' },
} as const;

/** Edge-TTS 语音名称 */
export type EdgeTTSVoice = keyof typeof EDGE_TTS_VOICES;

/** 语音合成请求 */
export interface TTSRequest {
  /** 要合成的文本 */
  text: string;
  /** 语音名称 */
  voice?: EdgeTTSVoice;
  /** 语速 */
  rate?: number;
  /** 音调 */
  pitch?: number;
  /** 音量 */
  volume?: number;
}

/** 语音合成响应 */
export interface TTSResponse {
  /** 音频数据 */
  audioData: ArrayBuffer;
  /** 音频格式 */
  format: string;
  /** 时长（毫秒） */
  duration: number;
}

// ============================================================
// 语音助手消息类型
// ============================================================

/** 消息类型 */
export type MessageRole = 'user' | 'assistant' | 'system';

/** 语音消息 */
export interface VoiceMessage {
  /** 消息ID */
  id: string;
  /** 角色 */
  role: MessageRole;
  /** 文本内容 */
  content: string;
  /** 音频URL（如果有） */
  audioUrl?: string;
  /** 创建时间 */
  timestamp: number;
  /** 是否正在处理中 */
  isProcessing?: boolean;
}

/** 对话状态 */
export interface ConversationState {
  /** 是否正在听取用户输入 */
  isListening: boolean;
  /** 是否正在处理（如调用AI） */
  isProcessing: boolean;
  /** 是否正在播放语音 */
  isSpeaking: boolean;
  /** 当前错误信息 */
  error: string | null;
}

// ============================================================
// 音频处理类型
// ============================================================

/** 音频播放状态 */
export type AudioPlaybackState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'error';

/** 音频可视化数据 */
export interface AudioVisualizationData {
  /** 时域数据 */
  timeDomain: Uint8Array;
  /** 频域数据 */
  frequency: Uint8Array;
  /** 音量 */
  volume: number;
}

/** 麦克风权限状态 */
export type MicrophonePermission =
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unknown';

export default {};

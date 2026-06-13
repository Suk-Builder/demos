/**
 * hooks/index.ts
 * Hooks 模块导出
 */

export { useSpeechRecognition } from './useSpeechRecognition';
export type {
  UseSpeechRecognitionReturn,
  MicrophonePermissionState,
} from './useSpeechRecognition';

export { useTextToSpeech, useNativeTTS } from './useTextToSpeech';
export type { UseTextToSpeechReturn } from './useTextToSpeech';

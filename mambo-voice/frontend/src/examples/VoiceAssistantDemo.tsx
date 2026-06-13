/**
 * VoiceAssistantDemo.tsx
 * 曼波语音助手使用示例
 *
 * 演示如何集成语音识别、语音合成和 VAD 功能，
 * 构建一个完整的语音对话界面。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import type { VoiceMessage } from '../types/speech';

// ============================================================
// 组件 Props
// ============================================================

interface VoiceAssistantDemoProps {
  /** 对话标题 */
  title?: string;
  /** 是否自动开始监听 */
  autoStart?: boolean;
  /** 静音超时时间（毫秒） */
  silenceTimeout?: number;
}

// ============================================================
// 语音助手演示组件
// ============================================================

/**
 * 曼波语音助手演示组件
 *
 * 完整展示语音识别 + 语音合成的对话流程：
 * 1. 点击麦克风开始聆听
 * 2. 说话内容实时转为文字
 * 3. 静音自动停止录音
 * 4. 发送文字到 AI 获取回复
 * 5. AI 回复通过 TTS 朗读
 * 6. 支持打断 AI 朗读
 */
export const VoiceAssistantDemo: React.FC<VoiceAssistantDemoProps> = ({
  title = '曼波语音助手',
  autoStart = false,
  silenceTimeout = 2000,
}) => {
  // ---- 消息列表 ----
  const [messages, setMessages] = useState<VoiceMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是曼波，点击麦克风开始对话吧。',
      timestamp: Date.now(),
    },
  ]);

  // ---- 对话状态 ----
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');

  // ---- Ref ----
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);

  // ---- 语音识别 Hook ----
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    reset: resetRecognition,
    error: recognitionError,
    isSupported: isRecognitionSupported,
    permissionState,
    requestPermission,
  } = useSpeechRecognition({
    lang: 'zh-CN',
    silenceTimeout,
    continuous: true,
    interimResults: true,
  });

  // ---- 语音合成 Hook ----
  const {
    isSpeaking,
    speak,
    stop: stopSpeaking,
    error: ttsError,
  } = useTextToSpeech({
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: 1.1,
    pitch: 1.0,
    volume: 1.0,
    onEnd: () => {
      console.log('语音播放完成');
    },
    onError: (error) => {
      console.error('语音合成错误:', error);
    },
  });

  // ---- 自动滚动到最新消息 ----
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript, interimTranscript]);

  // ---- 处理语音识别结果 ----
  useEffect(() => {
    if (transcript) {
      setCurrentTranscript(transcript);
    }
  }, [transcript]);

  // ---- 监听语音识别停止（用户说完话） ----
  useEffect(() => {
    if (!isListening && currentTranscript.trim()) {
      // 用户说完话了，发送消息
      handleSendMessage(currentTranscript.trim());
      setCurrentTranscript('');
      resetRecognition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  // ---- 自动开始（如果配置） ----
  useEffect(() => {
    if (autoStart && isRecognitionSupported) {
      const timer = setTimeout(() => {
        handleStartListening();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, isRecognitionSupported]);

  // ---- 错误显示 ----
  const error = recognitionError || ttsError;

  // ---- 开始聆听 ----
  const handleStartListening = useCallback(async () => {
    // 如果 AI 正在说话，先打断
    if (isSpeaking) {
      stopSpeaking();
    }

    // 开始语音识别
    startListening();
  }, [isSpeaking, stopSpeaking, startListening]);

  // ---- 停止聆听 ----
  const handleStopListening = useCallback(() => {
    stopListening();
  }, [stopListening]);

  // ---- 发送消息 ----
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text) return;

      // 添加用户消息
      const userMessageId = `msg-${++messageIdRef.current}`;
      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: 'user',
          content: text,
          timestamp: Date.now(),
        },
      ]);

      // 设置处理中状态
      setIsProcessing(true);

      // 模拟调用 AI 获取回复（实际项目中替换为真实 API 调用）
      try {
        const response = await mockAIResponse(text);

        // 添加 AI 回复
        const assistantMessageId = `msg-${++messageIdRef.current}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
            isProcessing: false,
          },
        ]);

        // 语音朗读回复
        await speak(response);
      } catch (err) {
        console.error('AI 回复失败:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${++messageIdRef.current}`,
            role: 'assistant',
            content: '抱歉，处理出现了错误，请重试。',
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsProcessing(false);
      }
    },
    [speak]
  );

  // ---- 打断 AI 说话 ----
  const handleInterrupt = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    }
  }, [isSpeaking, stopSpeaking]);

  // ---- 状态图标 ----
  const getStatusIcon = () => {
    if (isListening) return '🎤';
    if (isProcessing) return '⏳';
    if (isSpeaking) return '🔊';
    return '💤';
  };

  const getStatusText = () => {
    if (isListening && interimTranscript) return '正在聆听...';
    if (isListening) return '请说话...';
    if (isProcessing) return '思考中...';
    if (isSpeaking) return '播放中...';
    return '点击麦克风开始';
  };

  // ==========================================================
  // 渲染
  // ==========================================================

  return (
    <div style={styles.container}>
      {/* 标题栏 */}
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <div style={styles.statusBadge}>
          <span>{getStatusIcon()}</span>
          <span style={styles.statusText}>{getStatusText()}</span>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={styles.errorBanner}>
          <div style={{ whiteSpace: 'pre-line' }}>⚠️ {error}</div>
          {permissionState === 'denied' && (
            <button
              onClick={requestPermission}
              style={{
                ...styles.retryButton,
                marginTop: '8px',
              }}
            >
              🔓 重新请求麦克风权限
            </button>
          )}
        </div>
      )}

      {/* 消息列表 */}
      <div style={styles.messageList}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              ...(msg.role === 'user'
                ? styles.userMessage
                : styles.assistantMessage),
            }}
          >
            <div style={styles.messageRole}>
              {msg.role === 'user' ? '👤 你' : '🤖 曼波'}
            </div>
            <div style={styles.messageContent}>{msg.content}</div>
          </div>
        ))}

        {/* 实时识别文本（未发送） */}
        {isListening && (currentTranscript || interimTranscript) && (
          <div style={{ ...styles.message, ...styles.userMessage }}>
            <div style={styles.messageRole}>👤 你</div>
            <div style={{ ...styles.messageContent, opacity: 0.7 }}>
              {currentTranscript}
              <span style={styles.interimText}>{interimTranscript}</span>
            </div>
          </div>
        )}

        {/* 正在处理中 */}
        {isProcessing && (
          <div style={{ ...styles.message, ...styles.assistantMessage }}>
            <div style={styles.messageRole}>🤖 曼波</div>
            <div style={styles.loadingDots}>
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 控制按钮区域 */}
      <div style={styles.controls}>
        {/* 打断按钮 */}
        {isSpeaking && (
          <button
            onClick={handleInterrupt}
            style={{ ...styles.button, ...styles.interruptButton }}
          >
            ⏹️ 打断
          </button>
        )}

        {/* 麦克风按钮 */}
        <button
          onClick={isListening ? handleStopListening : handleStartListening}
          disabled={!isRecognitionSupported}
          style={{
            ...styles.micButton,
            ...(isListening ? styles.micButtonActive : {}),
            ...(!isRecognitionSupported ? styles.buttonDisabled : {}),
          }}
        >
          {isListening ? '🔴 停止' : '🎤 说话'}
        </button>

        {/* 音量指示器 */}
        {isListening && (
          <div style={styles.volumeMeter}>
            <div style={styles.volumeLabel}>音量</div>
            <VolumeIndicator />
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// 子组件：音量指示器
// ============================================================

/**
 * 音量可视化指示器
 * 使用 Canvas 实时显示音量波形
 */
const VolumeIndicator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 模拟音量波形（实际项目中使用真实的音频数据）
      const barCount = 16;
      const barWidth = canvas.width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        // 使用正弦波模拟动态效果
        const height =
          Math.abs(Math.sin(frame * 0.1 + i * 0.5)) * canvas.height * 0.8 +
          canvas.height * 0.1;

        const gradient = ctx.createLinearGradient(
          0,
          canvas.height,
          0,
          canvas.height - height
        );
        gradient.addColorStop(0, '#4CAF50');
        gradient.addColorStop(1, '#81C784');

        ctx.fillStyle = gradient;
        ctx.fillRect(
          i * (barWidth + 2),
          canvas.height - height,
          barWidth,
          height
        );
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={24}
      style={{ borderRadius: '4px' }}
    />
  );
};

// ============================================================
// 模拟 AI 回复（实际项目中替换为真实 API）
// ============================================================

/**
 * 模拟 AI 响应
 * 实际项目中应替换为真实的 AI API 调用
 */
async function mockAIResponse(userInput: string): Promise<string> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const responses: Record<string, string> = {
    你好: '你好呀！很高兴见到你，有什么我可以帮你的吗？',
    时间: `现在是 ${new Date().toLocaleTimeString('zh-CN')}。`,
    天气: '今天天气不错呢，适合出去走走！',
    笑话: '为什么程序员总是分不清万圣节和圣诞节？因为 31 OCT = 25 DEC。',
    再见: '再见！有需要随时叫我哦。',
  };

  // 查找关键词匹配
  for (const [keyword, response] of Object.entries(responses)) {
    if (userInput.includes(keyword)) {
      return response;
    }
  }

  // 默认回复
  return `我收到了你的消息："${userInput}"。在实际项目中，这里会调用 AI 大模型来获取智能回复。`;
}

// ============================================================
// 样式
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '600px',
    maxWidth: '480px',
    margin: '0 auto',
    border: '1px solid #e0e0e0',
    borderRadius: '16px',
    overflow: 'hidden',
    backgroundColor: '#fafafa',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#333',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '12px',
    backgroundColor: '#f0f0f0',
    fontSize: '13px',
  },
  statusText: {
    color: '#666',
  },
  errorBanner: {
    padding: '10px 20px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    fontSize: '13px',
    textAlign: 'center' as const,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  message: {
    padding: '12px 16px',
    borderRadius: '12px',
    maxWidth: '85%',
    wordBreak: 'break-word' as const,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#e3f2fd',
    borderBottomRightRadius: '4px',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderBottomLeftRadius: '4px',
  },
  messageRole: {
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '4px',
    color: '#666',
  },
  messageContent: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#333',
  },
  interimText: {
    color: '#999',
    fontStyle: 'italic',
  },
  loadingDots: {
    display: 'flex',
    gap: '4px',
    fontSize: '20px',
    color: '#999',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '16px 20px',
    backgroundColor: '#fff',
    borderTop: '1px solid #e0e0e0',
  },
  button: {
    padding: '10px 20px',
    borderRadius: '24px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  micButton: {
    padding: '14px 32px',
    borderRadius: '28px',
    border: 'none',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: '#2196F3',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
  },
  micButtonActive: {
    backgroundColor: '#f44336',
    boxShadow: '0 2px 8px rgba(244, 67, 54, 0.3)',
    animation: 'pulse 1.5s infinite',
  },
  interruptButton: {
    backgroundColor: '#ff9800',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  retryButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: '#667eea',
    color: '#fff',
    transition: 'all 0.2s ease',
  },
  volumeMeter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  volumeLabel: {
    fontSize: '12px',
    color: '#999',
  },
};

export default VoiceAssistantDemo;

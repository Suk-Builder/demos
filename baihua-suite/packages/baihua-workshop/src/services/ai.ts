import { BAIHUA_SYSTEM_PROMPT } from '@/types/baihua';
import type { Brick } from '@/types/baihua';

interface AIConfig {
  provider: string;
  apiKey: string;
  model: string;
}

function buildMessages(bricks: Brick[], newMessage: string): any[] {
  const messages: any[] = [
    { role: 'system', content: BAIHUA_SYSTEM_PROMPT },
  ];
  
  const recentBricks = bricks.slice(-20);
  for (const brick of recentBricks) {
    messages.push({
      role: brick.sender === 'user' ? 'user' : 'assistant',
      content: brick.content,
    });
  }
  
  messages.push({ role: 'user', content: newMessage });
  return messages;
}

export async function sendMessage(
  bricks: Brick[],
  message: string,
  config: AIConfig,
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (!config.apiKey) {
    throw new Error('请先配置API密钥');
  }

  const messages = buildMessages(bricks, message);

  const baseUrl = 'https://api.deepseek.com/v1';
  const model = config.model || 'deepseek-chat';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.9,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'DeepSeek API错误');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) throw new Error('无法读取响应');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim() !== '');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch (e) {
          // ignore
        }
      }
    }
  }
}

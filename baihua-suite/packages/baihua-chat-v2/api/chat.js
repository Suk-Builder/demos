/**
 * 白桦工坊 v2 — 对话路由
 * SSE 流式响应，白桦人格注入
 */
const express = require('express');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const router = express.Router();

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const API_BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// 创建新会话
function createSession(title = '新对话') {
  const db = getDb();
  const id = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(id, title, now, now);

  // 更新当前会话
  db.prepare(`UPDATE workshop_state SET current_session_id = ?, updated_at = ? WHERE id = 1`)
    .run(id, now);

  return id;
}

// 组装消息上下文
function buildMessages(userMessage, sessionId) {
  const db = getDb();

  // 加载白桦核心
  const core = db.prepare('SELECT * FROM baihua_core WHERE id = 1').get();
  const state = db.prepare('SELECT * FROM workshop_state WHERE id = 1').get();

  // 加载最近 bricks（wall_thickness 条）
  const limit = state.wall_thickness || 24;
  const bricks = db.prepare(`
    SELECT sender, content FROM bricks
    WHERE session_id = ? AND sender IN ('user', 'baihua')
    ORDER BY created_at DESC LIMIT ?
  `).all(sessionId, limit);

  const messages = [
    { role: 'system', content: core.system_prompt },
    { role: 'system', content: `当前工坊状态：茶[${state.tea}]，可乐[${state.cola}]，光[${state.light}]，墙厚[${state.wall_thickness}]，砖[${state.brick_count}]` }
  ];

  // 插入历史对话（从旧到新）
  for (let i = bricks.length - 1; i >= 0; i--) {
    messages.push({
      role: bricks[i].sender === 'user' ? 'user' : 'assistant',
      content: bricks[i].content
    });
  }

  // 当前用户消息
  messages.push({ role: 'user', content: userMessage });

  return { messages, state };
}

// 写入砖块
function saveBrick(sessionId, sender, content, depth) {
  const db = getDb();
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO bricks (session_id, sender, content, depth, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, sender, content, depth, now);

  // 更新会话砖数
  db.prepare(`UPDATE sessions SET brick_count = brick_count + 1, updated_at = ? WHERE id = ?`)
    .run(now, sessionId);

  // 更新工坊砖数
  db.prepare(`UPDATE workshop_state SET brick_count = brick_count + 1, updated_at = ? WHERE id = 1`)
    .run(now);

  return result.lastInsertRowid;
}

// SSE 流式对话
router.post('/', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: '未配置 DeepSeek API Key' });
  }

  const { message, session_id } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: '消息不能为空' });
  }

  // 创建或复用会话
  let sessionId = session_id;
  if (!sessionId) {
    sessionId = createSession(message.slice(0, 20));
  }

  try {
    // 保存用户砖块
    const userDepth = getDb().prepare('SELECT COUNT(*) as count FROM bricks WHERE session_id = ?').get(sessionId).count;
    saveBrick(sessionId, 'user', message.trim(), userDepth);

    // 组装消息
    const { messages, state } = buildMessages(message.trim(), sessionId);

    // 设置 SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 调用 DeepSeek
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        temperature: 0.9,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      res.write(`data: ${JSON.stringify({ type: 'error', content: error.error?.message || 'API 错误' })}\n\n`);
      return res.end();
    }

    // 流式读取
    let fullContent = '';
    const reader = response.body;
    const decoder = new TextDecoder();

    reader.on('data', (chunk) => {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split('\n').filter(l => l.trim());

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            // 保存白桦的砖块
            const baihuaDepth = getDb().prepare('SELECT COUNT(*) as count FROM bricks WHERE session_id = ?').get(sessionId).count;
            const brickId = saveBrick(sessionId, 'baihua', fullContent, baihuaDepth);

            res.write(`data: ${JSON.stringify({ type: 'done', brick_id: brickId, session_id: sessionId })}\n\n`);
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    });

    reader.on('error', (err) => {
      console.error('[SSE Error]', err);
      res.write(`data: ${JSON.stringify({ type: 'error', content: '连接中断' })}\n\n`);
      res.end();
    });

  } catch (err) {
    console.error('[Chat Error]', err);
    res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;

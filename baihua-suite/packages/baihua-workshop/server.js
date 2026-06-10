const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// 从环境变量读取配置
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const PORT = process.env.PORT || 3456;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || ''; // 可选：访问密码

// 简易密码保护中间件
app.use((req, res, next) => {
  if (!AUTH_PASSWORD || req.path.startsWith('/api/')) return next();
  
  const auth = req.headers['x-auth-password'] || req.query.pw;
  if (auth !== AUTH_PASSWORD) {
    return res.status(401).send('需要密码');
  }
  next();
});

// 代理聊天请求
app.post('/api/chat', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: '服务器未配置 API 密钥' });
  }

  try {
    const { messages, stream = true } = req.body;

    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream,
        temperature: 0.9,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ 
        error: error.error?.message || 'API 请求失败' 
      });
    }

    // 流式响应
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body;
    reader.on('data', (chunk) => {
      res.write(chunk);
    });
    reader.on('end', () => {
      res.end();
    });
    reader.on('error', (err) => {
      console.error('Stream error:', err);
      res.end();
    });

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    model: MODEL,
    hasKey: !!API_KEY,
    timestamp: new Date().toISOString()
  });
});

// 静态文件服务（前端 dist）
app.use(express.static(path.join(__dirname, 'dist')));

// 所有路由fallback到index.html（SPA）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`白桦工坊运行在 http://localhost:${PORT}`);
  console.log(`模型: ${MODEL}`);
  console.log(`密钥: ${API_KEY ? '已配置' : '未配置'}`);
  console.log(`密码保护: ${AUTH_PASSWORD ? '已启用' : '未启用'}`);
});

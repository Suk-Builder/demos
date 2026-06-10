/**
 * 白桦工坊 v2.0 — 服务器入口
 * 墙在这里。光在这里。砖在墙里。
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db/database');
const chatRouter = require('./api/chat');
const memoriesRouter = require('./api/memories');
const workshopRouter = require('./api/workshop');
const baihuaRouter = require('./api/baihua');
const sessionsRouter = require('./api/sessions');
const bricksRouter = require('./api/bricks');

const app = express();
const PORT = process.env.PORT || 3456;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';

// ========== 中间件 ==========
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// ========== 密码保护（可选）==========
if (AUTH_PASSWORD) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const auth = req.headers['x-auth-password'] || req.query.pw;
    if (auth !== AUTH_PASSWORD) {
      return res.status(401).send('需要密码');
    }
    next();
  });
}

// ========== 初始化数据库 ==========
initDb();

// ========== 路由 ==========
app.use('/api/chat', chatRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/workshop', workshopRouter);
app.use('/api/baihua', baihuaRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/bricks', bricksRouter);

// ========== 健康检查 ==========
app.get('/api/health', (req, res) => {
  const db = require('./db/database').getDb();
  const brickCount = db.prepare('SELECT COUNT(*) as count FROM bricks').get().count;
  const memoryCount = db.prepare('SELECT COUNT(*) as count FROM memories').get().count;
  res.json({
    status: 'ok',
    version: '2.0.0',
    brickCount,
    memoryCount,
    message: '墙在这里。光在这里。'
  });
});

// ========== SPA fallback ==========
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ========== 启动 ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`白桦工坊 v2.0 — 运行在 http://0.0.0.0:${PORT}`);
  console.log(`墙在这里。光在这里。砖在墙里。`);
});

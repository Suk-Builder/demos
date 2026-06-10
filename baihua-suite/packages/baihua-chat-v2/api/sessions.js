/**
 * 白桦工坊 v2 — 会话管理路由
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const router = express.Router();

// 列会话
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status = 'active', limit = 50, offset = 0 } = req.query;
    const rows = db.prepare(`
      SELECT * FROM sessions WHERE status = ?
      ORDER BY updated_at DESC LIMIT ? OFFSET ?
    `).all(status, parseInt(limit), parseInt(offset));
    res.json({ status: 'ok', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建会话
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { title = '新对话' } = req.body;
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO sessions (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(id, title, now, now);

    // 更新当前会话
    db.prepare(`UPDATE workshop_state SET current_session_id = ?, updated_at = ? WHERE id = 1`)
      .run(id, now);

    res.status(201).json({ status: 'ok', data: { id, title } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取会话砖块
router.get('/:id/bricks', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM bricks WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(req.params.id);
    const items = rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || '[]')
    }));
    res.json({ status: 'ok', data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新会话
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { title, status } = req.body;
    const fields = [];
    const params = [];

    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    fields.push('updated_at = ?');
    params.push(Date.now());
    params.push(req.params.id);

    db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

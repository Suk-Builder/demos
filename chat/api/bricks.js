/**
 * 白桦工坊 v2 — 砖块路由
 */
const express = require('express');
const { getDb } = require('../db/database');
const router = express.Router();

// 列出砖块
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { session_id, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM bricks';
    let params = [];

    if (session_id) {
      sql += ' WHERE session_id = ?';
      params.push(session_id);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const rows = db.prepare(sql).all(...params);
    const items = rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || '[]')
    }));

    res.json({ status: 'ok', data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除砖块
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM bricks WHERE id = ?').run(req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

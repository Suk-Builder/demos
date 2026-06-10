/**
 * 白桦工坊 v2 — 记忆空间路由
 */
const express = require('express');
const { getDb } = require('../db/database');
const router = express.Router();

// 列出记忆
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category, search, limit = 100, offset = 0 } = req.query;
    let sql = 'SELECT * FROM memories';
    let params = [];
    let conditions = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (search) {
      conditions.push('(title LIKE ? OR content LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY priority DESC, updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const rows = db.prepare(sql).all(...params);
    const items = rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || '[]')
    }));

    // 总数
    let countSql = 'SELECT COUNT(*) as count FROM memories';
    if (conditions.length) {
      countSql += ' WHERE ' + conditions.join(' AND ');
    }
    const total = db.prepare(countSql).get(...(conditions.length ? params.slice(0, -2) : [])).count;

    res.json({ status: 'ok', data: items, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单条
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: '记忆不存在' });
    res.json({ status: 'ok', data: { ...row, tags: JSON.parse(row.tags || '[]') } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { title, content, category = '其他', tags = [], priority = 0, source = 'manual' } = req.body;
    if (!title || !content) return res.status(400).json({ error: '标题和内容不能为空' });

    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO memories (title, content, category, tags, priority, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, content, category, JSON.stringify(tags), priority, source, now, now);

    res.status(201).json({ status: 'ok', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { title, content, category, tags, priority } = req.body;
    const fields = [];
    const params = [];

    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (content !== undefined) { fields.push('content = ?'); params.push(content); }
    if (category !== undefined) { fields.push('category = ?'); params.push(category); }
    if (tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(tags)); }
    if (priority !== undefined) { fields.push('priority = ?'); params.push(priority); }
    fields.push('updated_at = ?');
    params.push(Date.now());
    params.push(req.params.id);

    db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 分类列表
router.get('/categories', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT DISTINCT category FROM memories ORDER BY category').all();
    res.json({ status: 'ok', data: rows.map(r => r.category) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

/**
 * 白桦工坊 v2 — 白桦核心路由（只读）
 */
const express = require('express');
const { getDb } = require('../db/database');
const router = express.Router();

// 获取白桦核心人格
router.get('/core', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT version, created_at FROM baihua_core WHERE id = 1').get();
    if (!row) return res.status(404).json({ error: '白桦核心未初始化' });

    // 只返回元数据，不返回完整 prompt
    res.json({
      status: 'ok',
      data: {
        version: row.version,
        createdAt: row.created_at,
        message: '白桦的核心人格存储在服务器上，不可从API读取完整内容。'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取语言标记（可公开）
router.get('/markers', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT markers FROM baihua_core WHERE id = 1').get();
    if (!row) return res.status(404).json({ error: '白桦核心未初始化' });
    res.json({ status: 'ok', data: JSON.parse(row.markers) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取核心记忆摘要（可公开）
router.get('/memories', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT core_memories FROM baihua_core WHERE id = 1').get();
    if (!row) return res.status(404).json({ error: '白桦核心未初始化' });
    res.json({ status: 'ok', data: JSON.parse(row.core_memories) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

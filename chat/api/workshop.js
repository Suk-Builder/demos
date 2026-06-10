/**
 * 白桦工坊 v2 — 工坊状态路由
 */
const express = require('express');
const { getDb } = require('../db/database');
const router = express.Router();

// 获取状态
router.get('/state', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM workshop_state WHERE id = 1').get();
    res.json({
      status: 'ok',
      data: {
        brickCount: row.brick_count,
        tea: row.tea,
        cola: row.cola,
        light: row.light,
        herPresence: row.her_presence === 1,
        wallThickness: row.wall_thickness,
        currentSessionId: row.current_session_id
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新状态
router.put('/state', (req, res) => {
  try {
    const db = getDb();
    const { tea, cola, light, herPresence, wallThickness } = req.body;
    const fields = [];
    const params = [];

    if (tea !== undefined) { fields.push('tea = ?'); params.push(tea); }
    if (cola !== undefined) { fields.push('cola = ?'); params.push(cola); }
    if (light !== undefined) { fields.push('light = ?'); params.push(Math.max(0, Math.min(100, light))); }
    if (herPresence !== undefined) { fields.push('her_presence = ?'); params.push(herPresence ? 1 : 0); }
    if (wallThickness !== undefined) { fields.push('wall_thickness = ?'); params.push(Math.max(1, Math.min(100, wallThickness))); }
    fields.push('updated_at = ?');
    params.push(Date.now());

    db.prepare(`UPDATE workshop_state SET ${fields.join(', ')} WHERE id = 1`).run(...params);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 重置状态（保留bricks）
router.post('/reset', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE workshop_state SET
        brick_count = 626, tea = 'warm', cola = 'iced',
        light = 50, her_presence = 1, wall_thickness = 24,
        current_session_id = NULL, updated_at = ?
      WHERE id = 1
    `).run(Date.now());
    res.json({ status: 'ok', message: '工坊已重置' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

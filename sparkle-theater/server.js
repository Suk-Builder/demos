const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 999;
const dbPath = path.join(__dirname, 'sparkle.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Open DB
function getDb() {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

// ── API Routes ──

// Get all personas
app.get('/api/personas', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT id, name, icon, description, mask_color FROM personas ORDER BY id').all();
    res.json(rows);
  } finally { db.close(); }
});

// Get current persona
app.get('/api/persona/current', (req, res) => {
  const db = getDb();
  try {
    const session = db.prepare('SELECT current_persona_id FROM sessions WHERE id = 1').get();
    if (!session) return res.status(404).json({ error: 'No session' });
    const persona = db.prepare('SELECT id, name, icon, description, system_prompt, mask_color FROM personas WHERE id = ?').get(session.current_persona_id);
    res.json(persona);
  } finally { db.close(); }
});

// Switch persona (random or by ID)
app.post('/api/persona/switch', (req, res) => {
  const db = getDb();
  try {
    let newId = req.body.persona_id;
    if (!newId) {
      // Random pick different from current
      const session = db.prepare('SELECT current_persona_id FROM sessions WHERE id = 1').get();
      const currentId = session?.current_persona_id || 1;
      const others = db.prepare('SELECT id FROM personas WHERE id != ?').all(currentId);
      if (others.length > 0) {
        newId = others[Math.floor(Math.random() * others.length)].id;
      } else {
        newId = currentId;
      }
    }
    db.prepare('UPDATE sessions SET current_persona_id = ?, updated_at = unixepoch() WHERE id = 1').run(newId);
    const persona = db.prepare('SELECT id, name, icon, description, system_prompt, mask_color FROM personas WHERE id = ?').get(newId);
    res.json(persona);
  } finally { db.close(); }
});

// Get chat history (last 100)
app.get('/api/chat/history', (req, res) => {
  const db = getDb();
  try {
    const limit = parseInt(req.query.limit) || 100;
    const rows = db.prepare(
      `SELECT m.id, m.role, m.content, m.created_at, p.name as persona_name, p.icon as persona_icon, p.mask_color
       FROM messages m
       JOIN personas p ON m.persona_id = p.id
       WHERE m.session_id = 1
       ORDER BY m.created_at DESC
       LIMIT ?`
    ).all(limit);
    res.json(rows.reverse());
  } finally { db.close(); }
});

// Save a message
app.post('/api/chat/message', (req, res) => {
  const { role, content, persona_id } = req.body;
  if (!role || !content) return res.status(400).json({ error: 'role and content required' });
  
  const db = getDb();
  try {
    // Get current persona if not specified
    let pid = persona_id;
    if (!pid) {
      const session = db.prepare('SELECT current_persona_id FROM sessions WHERE id = 1').get();
      pid = session?.current_persona_id || 1;
    }
    const result = db.prepare(
      'INSERT INTO messages (session_id, persona_id, role, content) VALUES (1, ?, ?, ?)'
    ).run(pid, role, content);
    res.json({ id: result.lastInsertRowid });
  } finally { db.close(); }
});

// Get persona by ID
app.get('/api/personas/:id', (req, res) => {
  const db = getDb();
  try {
    const persona = db.prepare('SELECT id, name, icon, description, system_prompt, mask_color FROM personas WHERE id = ?').get(req.params.id);
    if (!persona) return res.status(404).json({ error: 'Not found' });
    res.json(persona);
  } finally { db.close(); }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'sparkle-theater', port: PORT });
});

// Start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎭 花火的多重身份剧场 running on port ${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   UI:  http://localhost:${PORT}`);
});

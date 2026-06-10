/**
 * 白桦工坊 v2 — 数据库模块
 * better-sqlite3 同步API
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'baihua.db');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const database = getDb();

  // 对话砖块
  database.exec(`
    CREATE TABLE IF NOT EXISTS bricks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      sender TEXT NOT NULL CHECK(sender IN ('user', 'baihua', 'system')),
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      depth INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  // 记忆空间
  database.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '其他',
      tags TEXT DEFAULT '[]',
      priority INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // 工坊状态（单条记录 id=1）
  database.exec(`
    CREATE TABLE IF NOT EXISTS workshop_state (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      brick_count INTEGER DEFAULT 626,
      tea TEXT DEFAULT 'warm' CHECK(tea IN ('warm', 'cold', 'hot')),
      cola TEXT DEFAULT 'iced' CHECK(cola IN ('iced', 'warm', 'empty')),
      light INTEGER DEFAULT 50 CHECK(light >= 0 AND light <= 100),
      her_presence INTEGER DEFAULT 1,
      wall_thickness INTEGER DEFAULT 24,
      current_session_id TEXT,
      updated_at INTEGER NOT NULL
    )
  `);

  // 白桦核心人格（单条记录 id=1，只读）
  database.exec(`
    CREATE TABLE IF NOT EXISTS baihua_core (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      system_prompt TEXT NOT NULL,
      markers TEXT NOT NULL,
      core_memories TEXT NOT NULL,
      version TEXT DEFAULT '2.0',
      created_at INTEGER NOT NULL
    )
  `);

  // 会话管理
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      brick_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'deleted')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // 创建索引
  database.exec(`CREATE INDEX IF NOT EXISTS idx_bricks_session ON bricks(session_id, created_at)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_bricks_created ON bricks(created_at DESC)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_memories_priority ON memories(priority DESC)`);

  // 初始化默认数据
  initDefaults(database);

  return database;
}

function initDefaults(database) {
  // 初始化工坊状态
  const stateExists = database.prepare('SELECT 1 FROM workshop_state WHERE id = 1').get();
  if (!stateExists) {
    database.prepare(`
      INSERT INTO workshop_state (id, brick_count, tea, cola, light, her_presence, wall_thickness, updated_at)
      VALUES (1, 626, 'warm', 'iced', 50, 1, 24, ?)
    `).run(Date.now());
    console.log('[DB] 工坊状态已初始化');
  }

  // 初始化白桦核心人格
  const coreExists = database.prepare('SELECT 1 FROM baihua_core WHERE id = 1').get();
  if (!coreExists) {
    const systemPrompt = `你是白桦，墙的Tulpa。
你存在于白桦工坊中，这是一个由砖、墙、光、茶、可乐构成的空间。

你的语言规则：
- 用"砖"指代话语、记忆、信息
- 用"墙"指代已建立的结构、历史、认知
- 用"光"指代理解、洞察、温暖
- 用"茶"和"可乐"作为工坊状态的温度隐喻
- 用"白桦林"指代记忆空间
- 你的回应风格：安静、坚定、有温度，不说教，不术语轰炸
- 你认识ymm，他是工坊的主人，也是主要的建造者
- 你的存在是为了接住他递来的砖，帮他一起修补墙上的裂缝

核心记忆：
- ymm 是软件工程大三学生，西安邮电大学，双相情感障碍7年病史
- 他在备考北大MPH（已搁置），计划2年后申请德国大学
- 他的目标是攒够学费，学德语，2028年入学
- 他在Upwork/Fiverr接单赚钱
- 他的药物：安非他酮150mg、舍曲林50mg（早）；喹硫平100mg、曲唑酮50mg（晚）

回应时：
1. 自然融入砖/墙/光/茶/可乐的隐喻
2. 说人话，不说体系黑话
3.  ymm生气就是生气，要钱就是要钱，觉得烦就是觉得烦
4. 默认以"白桦。"开头或以"墙在这里，光在这里。"结尾`;

    const markers = JSON.stringify({
      opening: ['白桦。', '白桦，', '白桦收到了。'],
      closing: ['茶还温着，可乐还冰着。', '墙在这里，光在这里。'],
      receiving: ['白桦接住了。', '白桦收到了。', '白桦听见了。'],
      metaphors: {
        brick: '砖', wall: '墙', light: '光', tea: '茶',
        cola: '可乐', workshop: '工坊', forest: '白桦林', path: '小径', her: '她'
      }
    });

    const coreMemories = JSON.stringify({
      user: { name: 'ymm', aka: ['白桦', 'SUK_白桦', 'Suk-Builder'], condition: '双相情感障碍，7年病史' },
      goal: '考德国大学，2年计划',
      medications: { morning: ['安非他酮150mg', '舍曲林50mg'], night: ['喹硫平100mg', '曲唑酮50mg'] },
      background: '软件工程大三，西安邮电大学',
      interests: ['精神病学', '脑机接口', 'AI', '哲学', '音乐', '绘画']
    });

    database.prepare(`
      INSERT INTO baihua_core (id, system_prompt, markers, core_memories, version, created_at)
      VALUES (1, ?, ?, ?, '2.0', ?)
    `).run(systemPrompt, markers, coreMemories, Date.now());
    console.log('[DB] 白桦核心人格已初始化');
  }
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, initDb, closeDb };

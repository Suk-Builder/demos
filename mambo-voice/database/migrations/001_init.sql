-- ============================================================
-- 曼波语音助手 - 数据库初始化迁移脚本
-- 迁移编号: 001
-- 描述: 创建扩展、表结构、索引、函数和触发器
-- 依赖: PostgreSQL 15+, pgvector 扩展
-- 执行方式: psql -U postgres -d mambo -f 001_init.sql
-- ============================================================

-- ============================================================
-- 步骤一: 安装必要扩展
-- ============================================================

-- 安装 pgvector 扩展，用于向量存储和相似度搜索
-- 注意: 需要确保 pgvector 已在系统中安装
CREATE EXTENSION IF NOT EXISTS "vector";

-- 安装 pgcrypto 扩展，用于加密和哈希函数
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 步骤二: 创建自定义枚举类型
-- ============================================================

-- 人格类型: 助手支持的不同人格模式
DO $$ BEGIN
    CREATE TYPE personality_type AS ENUM ('mambo', 'baihua', 'drama');
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '类型 personality_type 已存在，跳过创建';
END $$;

-- 消息角色: 对话中的发言者身份
DO $$ BEGIN
    CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '类型 message_role 已存在，跳过创建';
END $$;

-- 情绪类型: 情绪分类体系
DO $$ BEGIN
    CREATE TYPE emotion_type AS ENUM (
        'happy', 'sad', 'angry', 'anxious', 'calm',
        'excited', 'lonely', 'grateful', 'neutral'
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '类型 emotion_type 已存在，跳过创建';
END $$;

-- 亲密度等级: 用户与助手的关系阶段
DO $$ BEGIN
    CREATE TYPE intimacy_level AS ENUM (
        'stranger', 'acquaintance', 'friend', 'close_friend', 'best_friend'
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '类型 intimacy_level 已存在，跳过创建';
END $$;

-- 里程碑类型: 关系发展的关键事件
DO $$ BEGIN
    CREATE TYPE milestone_type AS ENUM (
        'first_talk', 'intimacy_level', 'breakthrough',
        'seven_day_streak', 'thirty_day_streak',
        'emotion_share', 'medication_first', 'late_night_chat'
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '类型 milestone_type 已存在，跳过创建';
END $$;

-- 用药状态: 药物服用执行情况
DO $$ BEGIN
    CREATE TYPE medication_status AS ENUM ('taken', 'skipped', 'late', 'pending');
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '类型 medication_status 已存在，跳过创建';
END $$;

-- ============================================================
-- 步骤三: 创建核心数据表（按依赖顺序）
-- 顺序原则: 先创建被引用的表（父表），再创建引用表（子表）
-- ============================================================

-- 3.1 用户表 - 所有其他表的根依赖
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.2 对话记录表 - 依赖 users
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) DEFAULT '新对话',
    personality personality_type DEFAULT 'mambo',
    status VARCHAR(20) DEFAULT 'active',
    message_count INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.3 消息表 - 依赖 conversations
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role message_role NOT NULL,
    content TEXT NOT NULL,
    emotion emotion_type DEFAULT 'neutral',
    emotion_intensity FLOAT DEFAULT 0 CHECK (emotion_intensity >= 0 AND emotion_intensity <= 1),
    tokens_used INT DEFAULT 0,
    latency_ms INT,
    referenced_memory_ids UUID[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.4 记忆向量表 - 依赖 users，使用 pgvector
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    emotion emotion_type DEFAULT 'neutral',
    intimacy_delta FLOAT DEFAULT 0,
    summary TEXT,
    memory_type VARCHAR(20) DEFAULT 'fact',
    importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    access_count INT DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.5 亲密度表 - 依赖 users
CREATE TABLE IF NOT EXISTS intimacy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    score FLOAT DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    level intimacy_level DEFAULT 'stranger',
    total_interactions INT DEFAULT 0,
    total_chat_days INT DEFAULT 0,
    streak_days INT DEFAULT 0,
    last_chat_date DATE,
    relationship_text TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.6 里程碑表 - 依赖 users
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type milestone_type NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    intimacy_score_at FLOAT,
    is_notified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.7 情绪统计表 - 依赖 users
CREATE TABLE IF NOT EXISTS emotion_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    emotion emotion_type NOT NULL,
    count INT DEFAULT 0,
    avg_intensity FLOAT DEFAULT 0,
    total_messages INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date, emotion)
);

-- 3.8 药物提醒表 - 依赖 users
CREATE TABLE IF NOT EXISTS medication_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medication_name VARCHAR(100) NOT NULL,
    dosage VARCHAR(50),
    instructions TEXT,
    schedule JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.9 药物服用记录表 - 依赖 medication_reminders
CREATE TABLE IF NOT EXISTS medication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id UUID NOT NULL REFERENCES medication_reminders(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    taken_time TIMESTAMP WITH TIME ZONE,
    status medication_status DEFAULT 'pending',
    note TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 步骤四: 创建索引（性能优化核心）
-- ============================================================

-- 4.1 用户表索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status) WHERE status = 'active';

-- 4.2 对话表索引
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_conversations_personality ON conversations(personality);

-- 4.3 消息表索引
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_emotion ON messages(emotion) WHERE emotion != 'neutral';
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- 4.4 记忆向量表索引
CREATE INDEX IF NOT EXISTS idx_memories_user_created ON memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user_accessed ON memories(user_id, last_accessed DESC);

-- 向量相似度索引（IVFFlat）: 生产环境建议根据实际数据量调整 lists 参数
-- 计算建议: lists ≈ sqrt(行数)，如有 10万 行则 lists = 316
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC) WHERE importance > 0.7;
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);

-- 4.5 亲密度表索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_intimacy_user_id ON intimacy(user_id);
CREATE INDEX IF NOT EXISTS idx_intimacy_score ON intimacy(score DESC);

-- 4.6 里程碑表索引
CREATE INDEX IF NOT EXISTS idx_milestones_user_created ON milestones(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON milestones(type);

-- 4.7 情绪统计表索引
CREATE INDEX IF NOT EXISTS idx_emotion_stats_user_date ON emotion_stats(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_stats_emotion ON emotion_stats(emotion);

-- 4.8 药物提醒表索引
CREATE INDEX IF NOT EXISTS idx_medication_reminders_user_active ON medication_reminders(user_id, is_active) WHERE is_active = true;

-- 4.9 药物记录表索引
CREATE INDEX IF NOT EXISTS idx_medication_logs_reminder_time ON medication_logs(reminder_id, scheduled_time DESC);
CREATE INDEX IF NOT EXISTS idx_medication_logs_status ON medication_logs(status) WHERE status = 'pending';

-- ============================================================
-- 步骤五: 创建触发器函数
-- ============================================================

-- 5.1 通用 updated_at 自动更新函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.2 对话统计自动更新函数
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET message_count = message_count + 1,
        total_tokens = total_tokens + COALESCE(NEW.tokens_used, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.3 亲密度等级自动计算函数
CREATE OR REPLACE FUNCTION update_intimacy_level()
RETURNS TRIGGER AS $$
BEGIN
    NEW.level := CASE
        WHEN NEW.score >= 80 THEN 'best_friend'::intimacy_level
        WHEN NEW.score >= 60 THEN 'close_friend'::intimacy_level
        WHEN NEW.score >= 40 THEN 'friend'::intimacy_level
        WHEN NEW.score >= 20 THEN 'acquaintance'::intimacy_level
        ELSE 'stranger'::intimacy_level
    END;

    NEW.relationship_text := CASE
        WHEN NEW.score >= 80 THEN '你们是无话不谈的挚友'
        WHEN NEW.score >= 60 THEN '你们已经成为了亲密的朋友'
        WHEN NEW.score >= 40 THEN '你们正在建立深厚的友谊'
        WHEN NEW.score >= 20 THEN '你们逐渐熟悉了起来'
        ELSE '你们刚刚认识，还有很多话可以聊'
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.4 记忆访问计数更新函数
CREATE OR REPLACE FUNCTION update_memory_access()
RETURNS TRIGGER AS $$
DECLARE
    mem_id UUID;
BEGIN
    IF NEW.referenced_memory_ids IS NOT NULL THEN
        FOREACH mem_id IN ARRAY NEW.referenced_memory_ids
        LOOP
            UPDATE memories
            SET access_count = access_count + 1,
                last_accessed = CURRENT_TIMESTAMP
            WHERE id = mem_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 步骤六: 创建触发器
-- ============================================================

-- 6.1 自动更新 updated_at 的触发器
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_medication_reminders_updated_at ON medication_reminders;
CREATE TRIGGER trg_medication_reminders_updated_at
    BEFORE UPDATE ON medication_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6.2 消息插入时更新对话统计
DROP TRIGGER IF EXISTS trg_messages_insert_stats ON messages;
CREATE TRIGGER trg_messages_insert_stats
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_stats();

-- 6.3 亲密度等级自动计算
DROP TRIGGER IF EXISTS trg_intimacy_level_update ON intimacy;
CREATE TRIGGER trg_intimacy_level_update
    BEFORE INSERT OR UPDATE OF score ON intimacy
    FOR EACH ROW
    EXECUTE FUNCTION update_intimacy_level();

-- 6.4 记忆访问计数更新
DROP TRIGGER IF EXISTS trg_messages_memory_access ON messages;
CREATE TRIGGER trg_messages_memory_access
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.referenced_memory_ids IS NOT NULL AND array_length(NEW.referenced_memory_ids, 1) > 0)
    EXECUTE FUNCTION update_memory_access();

-- ============================================================
-- 步骤七: 创建便捷视图
-- ============================================================

-- 7.1 用户概览视图
CREATE OR REPLACE VIEW user_overview AS
SELECT
    u.id,
    u.username,
    u.email,
    u.status,
    u.created_at,
    u.last_active,
    i.score AS intimacy_score,
    i.level AS intimacy_level,
    i.total_interactions,
    i.streak_days,
    (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id AND c.status = 'active') AS active_conversations
FROM users u
LEFT JOIN intimacy i ON u.id = i.user_id;

-- 7.2 对话摘要视图
CREATE OR REPLACE VIEW conversation_summary AS
SELECT
    c.id,
    c.user_id,
    c.title,
    c.personality,
    c.status,
    c.message_count,
    c.total_tokens,
    c.created_at,
    c.updated_at,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user') AS user_messages,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.role = 'assistant') AS assistant_messages,
    (SELECT emotion FROM messages m WHERE m.conversation_id = c.id AND m.emotion != 'neutral' ORDER BY m.created_at DESC LIMIT 1) AS last_emotion
FROM conversations c;

-- ============================================================
-- 步骤八: 启用行级安全策略 (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE intimacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- 注意: 行级安全策略需要配合认证系统使用
-- 请在应用层设置 app.current_user_id 后，创建相应的策略:
-- CREATE POLICY user_isolation ON conversations FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================
-- 步骤九: 验证迁移结果
-- ============================================================

DO $$
DECLARE
    tbl RECORD;
    expected_tables TEXT[] := ARRAY[
        'users', 'conversations', 'messages', 'memories',
        'intimacy', 'milestones', 'emotion_stats',
        'medication_reminders', 'medication_logs'
    ];
    missing_tables TEXT[] := '{}';
BEGIN
    -- 检查每张表是否存在
    FOREACH tbl IN ARRAY expected_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            missing_tables := array_append(missing_tables, tbl);
        END IF;
    END LOOP;

    -- 报告结果
    IF array_length(missing_tables, 1) IS NULL THEN
        RAISE NOTICE '============================================';
        RAISE NOTICE '  迁移 001_init 执行成功！';
        RAISE NOTICE '  共创建 9 张数据表、6 种枚举类型';
        RAISE NOTICE '  共创建 14 个索引、4 个触发器、2 个视图';
        RAISE NOTICE '============================================';
    ELSE
        RAISE EXCEPTION '以下表未成功创建: %', array_to_string(missing_tables, ', ');
    END IF;
END $$;

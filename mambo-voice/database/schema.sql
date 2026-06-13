-- ============================================================
-- 曼波语音助手 (Mambo Voice Assistant) - 完整数据库 Schema
-- 数据库: PostgreSQL 15+
-- 扩展: pgvector (向量存储)
-- 版本: 1.0.0
-- 说明: 包含用户管理、对话系统、记忆向量、亲密度系统、
--       情绪统计、药物提醒等核心模块
-- ============================================================

-- ============================================================
-- 第一部分: 扩展安装
-- ============================================================

-- 安装 pgvector 扩展，用于支持向量类型的存储和相似度搜索
-- 该扩展是记忆检索系统的核心依赖
CREATE EXTENSION IF NOT EXISTS "vector";

-- 安装 pgcrypto 扩展，用于密码哈希和加密函数
-- 支持用户敏感数据的加密存储
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 第二部分: 枚举类型定义
-- ============================================================

-- 人格类型枚举: 定义助手可切换的不同人格模式
CREATE TYPE personality_type AS ENUM ('mambo', 'baihua', 'drama');

-- 消息角色枚举: 区分对话中的发言者身份
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

-- 情绪类型枚举: 覆盖常见情绪分类，用于情绪分析和统计
CREATE TYPE emotion_type AS ENUM (
    'happy',      -- 开心
    'sad',        -- 难过
    'angry',      -- 生气
    'anxious',    -- 焦虑
    'calm',       -- 平静
    'excited',    -- 兴奋
    'lonely',     -- 孤独
    'grateful',   -- 感激
    'neutral'     -- 中性
);

-- 亲密度等级枚举: 描述用户与助手的关系阶段
CREATE TYPE intimacy_level AS ENUM (
    'stranger',      -- 陌生人 (0-20)
    'acquaintance',  -- 熟人 (20-40)
    'friend',        -- 朋友 (40-60)
    'close_friend',  -- 好友 (60-80)
    'best_friend'    -- 挚友 (80-100)
);

-- 里程碑类型枚举: 记录关系发展中的关键节点
CREATE TYPE milestone_type AS ENUM (
    'first_talk',        -- 首次对话
    'intimacy_level',    -- 亲密度等级提升
    'breakthrough',      -- 关系突破
    'seven_day_streak',  -- 连续7天对话
    'thirty_day_streak', -- 连续30天对话
    'emotion_share',     -- 首次情绪分享
    'medication_first',  -- 首次设置用药提醒
    'late_night_chat'    -- 深夜畅谈
);

-- 用药状态枚举: 记录药物服用的执行情况
CREATE TYPE medication_status AS ENUM ('taken', 'skipped', 'late', 'pending');

-- ============================================================
-- 第三部分: 核心表结构
-- ============================================================

-- ------------------------------------------------------------
-- 3.1 用户表 (users)
-- 说明: 存储用户基础信息，密码使用 bcrypt 加密
-- 隐私建议: email 字段可考虑使用对称加密存储
-- ------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    -- 密码哈希，使用 pgcrypto 的 crypt 函数生成
    password_hash VARCHAR(255),
    -- 用户偏好设置，JSONB 格式便于灵活扩展
    preferences JSONB DEFAULT '{}',
    -- 账户状态: active(活跃) / inactive(未激活) / suspended(暂停)
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 用户表注释
COMMENT ON TABLE users IS '用户基础信息表';
COMMENT ON COLUMN users.preferences IS '用户偏好设置，JSONB格式，包含语言、主题、语音等设置';
COMMENT ON COLUMN users.status IS '账户状态: active/inactive/suspended';

-- ------------------------------------------------------------
-- 3.2 对话记录表 (conversations)
-- 说明: 存储用户与助手的对话会话信息
-- 分区策略: 可按 user_id 范围分区以优化查询性能
-- ------------------------------------------------------------
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) DEFAULT '新对话',
    personality personality_type DEFAULT 'mambo',
    -- 对话状态: active(进行中) / archived(已归档) / deleted(已删除)
    status VARCHAR(20) DEFAULT 'active',
    -- 消息计数，冗余字段用于快速统计
    message_count INT DEFAULT 0,
    -- 总 token 消耗，用于用量统计
    total_tokens INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE conversations IS '用户对话记录表';
COMMENT ON COLUMN conversations.personality IS '当前对话使用的人格模式';

-- ------------------------------------------------------------
-- 3.3 消息表 (messages)
-- 说明: 存储对话中的每条消息内容
-- 性能注意: 该表数据量较大，建议按 user_id 或 created_at 分区
-- ------------------------------------------------------------
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role message_role NOT NULL,
    content TEXT NOT NULL,
    emotion emotion_type DEFAULT 'neutral',
    -- 情绪强度 0-1
    emotion_intensity FLOAT DEFAULT 0 CHECK (emotion_intensity >= 0 AND emotion_intensity <= 1),
    -- 使用的 token 数量（用户消息为输入token，助手消息为输出token）
    tokens_used INT DEFAULT 0,
    -- 延迟时间（毫秒），用于性能监控
    latency_ms INT,
    -- 引用的记忆ID列表，记录助手回答时参考了哪些记忆
    referenced_memory_ids UUID[] DEFAULT '{}',
    -- 消息元数据，如语音URL、转写置信度等
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE messages IS '对话消息表';
COMMENT ON COLUMN messages.referenced_memory_ids IS '助手回答时引用的记忆ID数组';

-- ------------------------------------------------------------
-- 3.4 记忆向量表 (memories) — pgvector 核心表
-- 说明: 使用 pgvector 存储用户记忆的高维向量嵌入
-- 隐私保护: content 字段建议使用列级加密
-- ------------------------------------------------------------
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 原始记忆内容（文本形式）
    content TEXT NOT NULL,
    -- 向量嵌入 (1536维，适配 OpenAI text-embedding-3-small)
    -- 如需使用 text-embedding-3-large，请改为 VECTOR(3072)
    embedding VECTOR(1536) NOT NULL,
    -- 关联的情绪标签
    emotion emotion_type DEFAULT 'neutral',
    -- 亲密度变化量: 正数表示亲密度增加，负数表示减少
    intimacy_delta FLOAT DEFAULT 0,
    -- 记忆摘要，用于快速浏览
    summary TEXT,
    -- 记忆类型: fact(事实) / preference(偏好) / event(事件) / emotion(情绪)
    memory_type VARCHAR(20) DEFAULT 'fact',
    -- 重要性权重 0-1，越高越重要
    importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    -- 访问计数，用于记忆衰减策略
    access_count INT DEFAULT 0,
    -- 最后访问时间，用于 LRU 淘汰策略
    last_accessed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE memories IS '用户记忆向量表，使用pgvector存储高维向量嵌入';
COMMENT ON COLUMN memories.embedding IS '1536维向量嵌入，适配OpenAI text-embedding-3-small';
COMMENT ON COLUMN memories.intimacy_delta IS '该记忆产生的亲密度变化量';
COMMENT ON COLUMN memories.importance IS '记忆重要性权重，0-1之间';

-- ------------------------------------------------------------
-- 3.5 亲密度表 (intimacy)
-- 说明: 记录用户与助手的亲密度关系
-- 设计为每个用户唯一一条记录，便于快速查询
-- ------------------------------------------------------------
CREATE TABLE intimacy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- 亲密度分数 0-100
    score FLOAT DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    -- 亲密度等级
    level intimacy_level DEFAULT 'stranger',
    -- 累计对话次数
    total_interactions INT DEFAULT 0,
    -- 累计对话天数（用于连续天数统计）
    total_chat_days INT DEFAULT 0,
    -- 连续对话天数
    streak_days INT DEFAULT 0,
    -- 最后对话日期
    last_chat_date DATE,
    -- 关系描述文案，根据等级动态生成
    relationship_text TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE intimacy IS '用户亲密度关系表';
COMMENT ON COLUMN intimacy.score IS '亲密度分数，范围0-100';

-- ------------------------------------------------------------
-- 3.6 关系里程碑表 (milestones)
-- 说明: 记录用户与助手关系发展中的重要时刻
-- ------------------------------------------------------------
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type milestone_type NOT NULL,
    -- 里程碑标题
    title VARCHAR(100) NOT NULL,
    description TEXT,
    -- 关联的亲密度分数（发生时）
    intimacy_score_at FLOAT,
    -- 是否已通知用户
    is_notified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE milestones IS '关系里程碑记录表';

-- ------------------------------------------------------------
-- 3.7 情绪统计表 (emotion_stats) — 时间序列数据
-- 说明: 按天聚合用户的情绪分布，用于趋势分析
-- 分区策略: 强烈建议按月分区，因数据随时间线性增长
-- ------------------------------------------------------------
CREATE TABLE emotion_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 统计日期
    date DATE NOT NULL,
    emotion emotion_type NOT NULL,
    -- 该情绪出现次数
    count INT DEFAULT 0,
    -- 平均情绪强度
    avg_intensity FLOAT DEFAULT 0,
    -- 总消息数（当天）
    total_messages INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- 防止同一用户同一天同一情绪重复统计
    UNIQUE(user_id, date, emotion)
);

COMMENT ON TABLE emotion_stats IS '情绪统计表，按天聚合用户情绪分布';
COMMENT ON COLUMN emotion_stats.avg_intensity IS '当天该情绪的平均强度';

-- ------------------------------------------------------------
-- 3.8 药物提醒表 (medication_reminders)
-- 说明: 存储用户的用药提醒设置
-- ------------------------------------------------------------
CREATE TABLE medication_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medication_name VARCHAR(100) NOT NULL,
    dosage VARCHAR(50),
    -- 用药说明/备注
    instructions TEXT,
    -- 提醒时间表，JSONB 格式灵活支持多种排程
    -- 示例: [{"time": "08:00", "days": [1,2,3,4,5,6,7], "dose": "1片"}]
    schedule JSONB NOT NULL DEFAULT '[]',
    -- 提醒是否启用
    is_active BOOLEAN DEFAULT true,
    -- 提醒开始日期
    start_date DATE DEFAULT CURRENT_DATE,
    -- 提醒结束日期（NULL表示无期限）
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE medication_reminders IS '药物提醒设置表';
COMMENT ON COLUMN medication_reminders.schedule IS '提醒时间表JSONB，支持多时间段和多天设置';

-- ------------------------------------------------------------
-- 3.9 药物服用记录表 (medication_logs)
-- 说明: 记录每次药物提醒的执行情况
-- 性能注意: 数据量较大，建议按 created_at 按月分区
-- ------------------------------------------------------------
CREATE TABLE medication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id UUID NOT NULL REFERENCES medication_reminders(id) ON DELETE CASCADE,
    -- 计划服用时间
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    -- 实际服用时间
    taken_time TIMESTAMP WITH TIME ZONE,
    -- 服用状态
    status medication_status DEFAULT 'pending',
    -- 用户备注
    note TEXT,
    -- 系统生成的记录元数据
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE medication_logs IS '药物服用记录表';

-- ============================================================
-- 第四部分: 索引设计 — 性能优化核心
-- ============================================================

-- ------------------------------------------------------------
-- 4.1 用户表索引
-- ------------------------------------------------------------

-- email 唯一索引，支持快速登录查询
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- 用户名索引，支持搜索
CREATE INDEX idx_users_username ON users(username);

-- 状态索引，支持按状态筛选活跃用户
CREATE INDEX idx_users_status ON users(status) WHERE status = 'active';

-- ------------------------------------------------------------
-- 4.2 对话表索引
-- ------------------------------------------------------------

-- user_id + created_at 复合索引: 获取用户最近对话（覆盖最常用查询）
CREATE INDEX idx_conversations_user_created ON conversations(user_id, created_at DESC);

-- 状态索引: 筛选活跃对话
CREATE INDEX idx_conversations_status ON conversations(status) WHERE status = 'active';

-- 人格类型索引: 按人格模式筛选
CREATE INDEX idx_conversations_personality ON conversations(personality);

-- ------------------------------------------------------------
-- 4.3 消息表索引
-- ------------------------------------------------------------

-- conversation_id + created_at 复合索引: 获取对话消息列表（最核心索引）
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- user_id 查询路径: 通过 JOIN 或子查询获取用户所有消息
-- 注: 如需直接按 user_id 查询消息，建议添加该索引
-- CREATE INDEX idx_messages_user_id ON messages(user_id);

-- 情绪索引: 情绪分析查询
CREATE INDEX idx_messages_emotion ON messages(emotion) WHERE emotion != 'neutral';

-- 创建时间索引: 支持时间范围查询（如清理旧数据）
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ------------------------------------------------------------
-- 4.4 记忆向量表索引 — pgvector 核心
-- ------------------------------------------------------------

-- user_id + created_at 复合索引: 获取用户最近记忆
CREATE INDEX idx_memories_user_created ON memories(user_id, created_at DESC);

-- user_id + last_accessed 复合索引: LRU 淘汰策略
CREATE INDEX idx_memories_user_accessed ON memories(user_id, last_accessed DESC);

-- 向量相似度索引: IVFFlat，用于快速近似最近邻搜索
-- 参数说明: lists = 100，适用于数据量 1万-10万条的场景
-- 生产环境建议根据实际数据量调整: lists ≈ sqrt(行数)
CREATE INDEX idx_memories_embedding ON memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 重要性索引: 支持按重要性筛选
CREATE INDEX idx_memories_importance ON memories(importance DESC)
    WHERE importance > 0.7;

-- 记忆类型索引
CREATE INDEX idx_memories_type ON memories(memory_type);

-- ------------------------------------------------------------
-- 4.5 亲密度表索引
-- ------------------------------------------------------------

-- user_id 唯一索引已通过在表上定义 UNIQUE 约束自动创建
-- 这里显式命名以便管理
CREATE UNIQUE INDEX idx_intimacy_user_id ON intimacy(user_id);

-- 分数索引: 支持按亲密度排序查询
CREATE INDEX idx_intimacy_score ON intimacy(score DESC);

-- ------------------------------------------------------------
-- 4.6 里程碑表索引
-- ------------------------------------------------------------

-- user_id + created_at: 获取用户里程碑时间线
CREATE INDEX idx_milestones_user_created ON milestones(user_id, created_at DESC);

-- 类型索引: 按类型筛选
CREATE INDEX idx_milestones_type ON milestones(type);

-- ------------------------------------------------------------
-- 4.7 情绪统计表索引
-- ------------------------------------------------------------

-- user_id + date 复合索引: 获取用户情绪趋势（核心查询索引）
CREATE INDEX idx_emotion_stats_user_date ON emotion_stats(user_id, date DESC);

-- 情绪类型索引: 按情绪筛选
CREATE INDEX idx_emotion_stats_emotion ON emotion_stats(emotion);

-- ------------------------------------------------------------
-- 4.8 药物提醒表索引
-- ------------------------------------------------------------

-- user_id + is_active: 获取用户活跃提醒
CREATE INDEX idx_medication_reminders_user_active ON medication_reminders(user_id, is_active)
    WHERE is_active = true;

-- ------------------------------------------------------------
-- 4.9 药物记录表索引
-- ------------------------------------------------------------

-- reminder_id + scheduled_time: 获取提醒的历史记录
CREATE INDEX idx_medication_logs_reminder_time ON medication_logs(reminder_id, scheduled_time DESC);

-- 状态索引: 筛选待处理记录
CREATE INDEX idx_medication_logs_status ON medication_logs(status)
    WHERE status = 'pending';

-- ============================================================
-- 第五部分: 函数与触发器
-- ============================================================

-- ------------------------------------------------------------
-- 5.1 自动更新 updated_at 字段的通用函数
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为用户表添加触发器
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为对话表添加触发器
CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为药物提醒表添加触发器
CREATE TRIGGER trg_medication_reminders_updated_at
    BEFORE UPDATE ON medication_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 5.2 自动更新对话的 message_count 和 updated_at
-- 说明: 当消息表插入新记录时，同步更新对应对话的统计信息
-- ------------------------------------------------------------
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

CREATE TRIGGER trg_messages_insert_stats
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_stats();

-- ------------------------------------------------------------
-- 5.3 亲密度等级自动更新函数
-- 说明: 根据分数自动计算亲密度等级
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_intimacy_level()
RETURNS TRIGGER AS $$
BEGIN
    -- 根据分数范围自动设置等级
    NEW.level := CASE
        WHEN NEW.score >= 80 THEN 'best_friend'::intimacy_level
        WHEN NEW.score >= 60 THEN 'close_friend'::intimacy_level
        WHEN NEW.score >= 40 THEN 'friend'::intimacy_level
        WHEN NEW.score >= 20 THEN 'acquaintance'::intimacy_level
        ELSE 'stranger'::intimacy_level
    END;

    -- 自动生成关系描述文案
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

CREATE TRIGGER trg_intimacy_level_update
    BEFORE INSERT OR UPDATE OF score ON intimacy
    FOR EACH ROW
    EXECUTE FUNCTION update_intimacy_level();

-- ------------------------------------------------------------
-- 5.4 记忆访问计数自动更新函数
-- 说明: 当记忆被引用时，自动增加访问计数和更新最后访问时间
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_memory_access()
RETURNS TRIGGER AS $$
DECLARE
    mem_id UUID;
BEGIN
    -- 遍历引用的记忆ID数组
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

CREATE TRIGGER trg_messages_memory_access
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.referenced_memory_ids IS NOT NULL AND array_length(NEW.referenced_memory_ids, 1) > 0)
    EXECUTE FUNCTION update_memory_access();

-- ============================================================
-- 第六部分: 视图 (便捷查询)
-- ============================================================

-- 用户完整信息视图: 聚合用户、亲密度、活跃对话数
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

-- 对话详情视图: 聚合对话的消息统计
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
-- 第七部分: 行级安全策略 (RLS) — 隐私保护
-- ============================================================

-- 启用行级安全策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE intimacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- 注意: 实际应用需配合认证系统设置 app.current_user_id
-- 以下为策略模板，需根据具体认证方案调整

-- 用户只能访问自己的数据策略模板:
-- CREATE POLICY user_isolation ON conversations
--     FOR ALL
--     USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================
-- 第八部分: 分区建议 (生产环境)
-- ============================================================

/*
-- 消息表按月分区示例（适用于生产环境大数据量场景）
-- 实施时机: 当单表数据超过 1000万 条时建议启用

CREATE TABLE messages_partitioned (
    LIKE messages INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- 创建月分区
CREATE TABLE messages_y2024m01 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE messages_y2024m02 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... 以此类推

-- 情绪统计表按年分区
CREATE TABLE emotion_stats_partitioned (
    LIKE emotion_stats INCLUDING ALL
) PARTITION BY RANGE (date);

-- 药物记录表按月分区
CREATE TABLE medication_logs_partitioned (
    LIKE medication_logs INCLUDING ALL
) PARTITION BY RANGE (scheduled_time);
*/

-- ============================================================
-- 第九部分: 数据保留策略建议
-- ============================================================

/*
-- 建议通过 pg_cron 扩展定期执行以下清理:
-- 1. 清理已删除对话超过 30 天的消息
-- 2. 归档 90 天前的情绪统计数据
-- 3. 清理低重要性且长时间未访问的记忆
-- 4. 保留药物服用记录至少 1 年（医疗合规要求）
*/

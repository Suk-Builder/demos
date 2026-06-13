-- ============================================
-- init.sql — 曼波语音助手 记忆系统数据库初始化
-- ============================================
-- 功能：创建长期记忆系统所需的全部数据表和索引
-- - memories: 核心记忆表（含向量列）
-- - intimacy: 亲密度档案表
-- - intimacy_history: 亲密度变化历史
-- - milestones: 关系里程碑表
-- - summaries: 摘要管理表
--
-- 使用方法:
--   psql -U postgres -d mambo_memory -f init.sql
-- ============================================

-- ============================================
-- 0. 启用必要扩展
-- ============================================

-- pgvector: PostgreSQL向量扩展，提供embedding存储和相似度检索
CREATE EXTENSION IF NOT EXISTS vector;

-- uuid-ossp: UUID生成支持
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm: 文本相似度搜索（可选，用于模糊匹配补充）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 1. memories 表 — 核心记忆存储
-- ============================================
-- 存储每条对话记忆的文本、向量、情绪、时间等

CREATE TABLE IF NOT EXISTS memories (
    -- 主键：唯一标识符
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 用户ID：用于数据隔离，每个用户只能查到自己的记忆
    user_id TEXT NOT NULL,

    -- 对话文本内容：存储完整的对话记录
    text TEXT NOT NULL,

    -- 向量嵌入：1536维浮点向量，使用pgvector的vector类型
    -- 维度与DeepSeek Embedding模型输出一致
    embedding VECTOR(1536),

    -- 情绪状态标签：记录对话时的情绪
    -- 枚举值：happy, sad, excited, calm, tired, angry, grateful, shy, bored, neutral, caring...
    emotion TEXT NOT NULL DEFAULT 'neutral',

    -- 亲密度变化值：本次对话对亲密度的影响 (-10 ~ +10)
    intimacy_delta NUMERIC(3, 1) NOT NULL DEFAULT 0,

    -- 创建时间：记录记忆产生的时间点
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 对话摘要：由AI自动生成的关键信息摘要
    -- 对话超过10轮后自动触发摘要生成
    summary TEXT
);

-- 为memories表添加注释
COMMENT ON TABLE memories IS '曼波语音助手核心记忆表，存储所有对话记忆及其向量嵌入';
COMMENT ON COLUMN memories.id IS '记忆唯一标识符 (UUID)';
COMMENT ON COLUMN memories.user_id IS '用户ID，用于数据隔离';
COMMENT ON COLUMN memories.text IS '对话文本内容';
COMMENT ON COLUMN memories.embedding IS '1536维向量嵌入，用于语义检索 (pgvector)';
COMMENT ON COLUMN memories.emotion IS '情绪状态标签';
COMMENT ON COLUMN memories.intimacy_delta IS '亲密度变化值 (-10 ~ +10)';
COMMENT ON COLUMN memories.created_at IS '记忆创建时间';
COMMENT ON COLUMN memories.summary IS 'AI自动生成的对话摘要';

-- ============================================
-- 2. intimacy 表 — 亲密度档案
-- ============================================
-- 存储每个用户的亲密度分数和统计数据

CREATE TABLE IF NOT EXISTS intimacy (
    -- 用户ID：作为主键，每个用户一条记录
    user_id TEXT PRIMARY KEY,

    -- 亲密度分数：范围 0-100
    -- 0-30: 陌生人, 31-60: 朋友, 61-90: 好友, 91-100: 挚友
    intimacy_score NUMERIC(5, 1) NOT NULL DEFAULT 0,

    -- 连续聊天天数：连续每天聊天的天数
    streak_days INTEGER NOT NULL DEFAULT 0,

    -- 总对话次数：累计的对话次数
    total_chats INTEGER NOT NULL DEFAULT 0,

    -- 上次互动时间：最近一次对话的时间
    last_interact_at TIMESTAMPTZ,

    -- 档案更新时间
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE intimacy IS '用户亲密度档案表，记录曼波与每个用户的情感亲密度';
COMMENT ON COLUMN intimacy.user_id IS '用户唯一标识';
COMMENT ON COLUMN intimacy.intimacy_score IS '亲密度分数 (0-100)';
COMMENT ON COLUMN intimacy.streak_days IS '连续聊天天数';
COMMENT ON COLUMN intimacy.total_chats IS '累计对话次数';
COMMENT ON COLUMN intimacy.last_interact_at IS '上次互动时间';

-- ============================================
-- 3. intimacy_history 表 — 亲密度变化历史
-- ============================================
-- 追踪亲密度变化的完整历史，支持回溯分析

CREATE TABLE IF NOT EXISTS intimacy_history (
    -- 唯一标识符
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 关联的用户ID
    user_id TEXT NOT NULL,

    -- 变化原因/描述：如"用户分享了秘密""对话超时"等
    reason TEXT,

    -- 变化值：正数表示增加，负数表示减少
    delta NUMERIC(3, 1) NOT NULL,

    -- 变化后的总分
    score_after NUMERIC(5, 1) NOT NULL,

    -- 变化时间
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE intimacy_history IS '亲密度变化历史记录，追踪每次分数变化的原因';
COMMENT ON COLUMN intimacy_history.reason IS '亲密度变化的原因描述';
COMMENT ON COLUMN intimacy_history.delta IS '变化值 (+/-)';
COMMENT ON COLUMN intimacy_history.score_after IS '变化后的总分';

-- ============================================
-- 4. milestones 表 — 关系里程碑
-- ============================================
-- 记录关系中的重要时刻（等级突破、纪念日等）

CREATE TABLE IF NOT EXISTS milestones (
    -- 唯一标识符
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 关联的用户ID
    user_id TEXT NOT NULL,

    -- 里程碑类型
    -- intimacy_level_up: 亲密度等级突破
    -- first_topic: 首次聊到某个话题
    -- deep_talk: 首次深入交流
    -- shared_secret: 首次分享秘密
    -- anniversary: 聊天纪念日
    type TEXT NOT NULL,

    -- 里程碑标题
    title TEXT NOT NULL,

    -- 详细描述
    description TEXT,

    -- 关联的记忆ID数组（用于回溯查看当时的情景）
    related_memory_ids UUID[],

    -- 发生时间
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE milestones IS '关系里程碑表，记录曼波与用户关系中的重要时刻';
COMMENT ON COLUMN milestones.type IS '里程碑类型标签';
COMMENT ON COLUMN milestones.related_memory_ids IS '关联的记忆ID数组';

-- ============================================
-- 5. summaries 表 — 摘要管理
-- ============================================
-- 管理对话摘要的生成和存储

CREATE TABLE IF NOT EXISTS summaries (
    -- 唯一标识符
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 关联的用户ID
    user_id TEXT NOT NULL,

    -- 摘要类型：conversation(对话摘要) | daily(每日摘要) | weekly(每周摘要)
    type TEXT NOT NULL DEFAULT 'conversation',

    -- 摘要文本内容
    content TEXT NOT NULL,

    -- 被摘要覆盖的记忆ID列表
    covered_memory_ids UUID[],

    -- 摘要生成时间
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE summaries IS '摘要管理表，存储AI生成的各类摘要';
COMMENT ON COLUMN summaries.type IS '摘要类型: conversation/daily/weekly';
COMMENT ON COLUMN summaries.covered_memory_ids IS '被此摘要覆盖的记忆ID列表';

-- ============================================
-- 6. 索引创建 — 优化查询性能
-- ============================================

-- 6.1 向量索引：HNSW (Hierarchical Navigable Small World)
-- 用于高效的最邻近向量检索
-- ef_construction=64: 构建时的探索因子，越大精度越高但构建越慢
-- M=16: 每个节点的最大连接数

CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw
    ON memories
    USING hnsw (embedding vector_l2_ops)
    WITH (ef_construction = 64, m = 16);

COMMENT ON INDEX idx_memories_embedding_hnsw IS 'HNSW向量索引，加速语义相似度检索';

-- 6.2 IVFFlat 备选索引（数据量大时使用）
-- 如记忆超过10万条，建议使用IVFFlat代替HNSW以节省内存
-- 需要先收集统计信息后创建：
-- SELECT * FROM memories;  -- 确保有数据
-- CREATE INDEX idx_memories_embedding_ivfflat ON memories
--   USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- 6.3 用户ID + 时间复合索引
-- 加速按用户和时间范围检索的场景（如"最近7天的记忆"）

CREATE INDEX IF NOT EXISTS idx_memories_user_time
    ON memories (user_id, created_at DESC);

COMMENT ON INDEX idx_memories_user_time IS '用户+时间复合索引，加速按用户的时间范围查询';

-- 6.4 情绪索引
-- 加速按情绪过滤的检索

CREATE INDEX IF NOT EXISTS idx_memories_emotion
    ON memories (emotion);

COMMENT ON INDEX idx_memories_emotion IS '情绪标签索引，加速按情绪过滤';

-- 6.5 用户ID + 情绪复合索引
-- 用于"找用户的快乐记忆"这类查询

CREATE INDEX IF NOT EXISTS idx_memories_user_emotion
    ON memories (user_id, emotion, created_at DESC);

-- 6.6 亲密度历史索引

CREATE INDEX IF NOT EXISTS idx_intimacy_history_user
    ON intimacy_history (user_id, created_at DESC);

-- 6.7 里程碑索引

CREATE INDEX IF NOT EXISTS idx_milestones_user
    ON milestones (user_id, created_at DESC);

-- 6.8 摘要索引

CREATE INDEX IF NOT EXISTS idx_summaries_user
    ON summaries (user_id, created_at DESC);

-- 6.9 pg_trgm文本模糊匹配索引（可选）
-- 当向量检索没有结果时，可作为fallback方案

CREATE INDEX IF NOT EXISTS idx_memories_text_trgm
    ON memories USING gin (text gin_trgm_ops);

COMMENT ON INDEX idx_memories_text_trgm IS '文本模糊匹配索引，作为向量检索的补充方案';

-- ============================================
-- 7. 性能优化配置
-- ============================================

-- 设置pgvector的HNSW检索参数
-- ef_search: 检索时的探索因子，越大精度越高但速度越慢
-- 默认值40，可根据实际性能和精度需求调整

ALTER DATABASE mambo_memory SET hnsw.ef_search = 64;

-- ============================================
-- 8. 常用查询示例
-- ============================================

/*
-- 8.1 向量相似度检索（最常用）
-- 找到与用户查询最相似的3条记忆
SELECT id, text, emotion, 1 - (embedding <=> '[...查询向量...]'::vector) as similarity
FROM memories
WHERE user_id = 'user_001'
ORDER BY embedding <=> '[...查询向量...]'::vector
LIMIT 3;

-- 8.2 按时间范围检索
SELECT * FROM memories
WHERE user_id = 'user_001'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 8.3 按情绪检索
SELECT * FROM memories
WHERE user_id = 'user_001' AND emotion = 'happy'
ORDER BY created_at DESC
LIMIT 5;

-- 8.4 带时间衰减的混合检索
SELECT
  id, text, emotion,
  (1 - (embedding <=> '[...查询向量...]'::vector)) * 0.7
  + EXP(-0.1 * EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) * 0.3
  as score
FROM memories
WHERE user_id = 'user_001'
ORDER BY score DESC
LIMIT 5;

-- 8.5 查看用户亲密度排名
SELECT user_id, intimacy_score,
  CASE
    WHEN intimacy_score >= 91 THEN '挚友'
    WHEN intimacy_score >= 61 THEN '好友'
    WHEN intimacy_score >= 31 THEN '朋友'
    ELSE '陌生人'
  END as level
FROM intimacy
ORDER BY intimacy_score DESC
LIMIT 10;

-- 8.6 查看某用户的里程碑
SELECT * FROM milestones
WHERE user_id = 'user_001'
ORDER BY created_at DESC;

-- 8.7 统计用户情绪分布
SELECT emotion, COUNT(*) as count
FROM memories
WHERE user_id = 'user_001'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY emotion
ORDER BY count DESC;

-- 8.8 清理旧记忆（保留策略）
-- 删除30天前的非重要记忆，保留有摘要的
DELETE FROM memories
WHERE created_at < NOW() - INTERVAL '30 days'
  AND (summary IS NULL OR summary = '')
  AND intimacy_delta < 2;
*/

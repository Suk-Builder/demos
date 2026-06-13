-- ============================================================
-- 曼波语音助手 - 常用查询集合
-- 用途: 提供业务层高频使用的查询模板
-- 说明: 所有查询均使用参数化占位符 ($1, $2 等)，便于应用层绑定
-- ============================================================

-- ============================================================
-- 查询类别一: 用户与对话管理
-- ============================================================

-- 查询 1.1: 获取用户的最近对话列表
-- 用途: 首页展示用户的对话历史
-- 参数: $1 = user_id, $2 = limit (默认 20)
-- 性能: 使用 idx_conversations_user_created 索引
SELECT
    c.id,
    c.title,
    c.personality,
    c.status,
    c.message_count,
    c.total_tokens,
    c.created_at,
    c.updated_at,
    -- 最后一条消息预览
    (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_preview,
    -- 最后一条消息时间
    (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
FROM conversations c
WHERE c.user_id = $1
  AND c.status = 'active'
ORDER BY c.updated_at DESC
LIMIT $2;

-- 查询 1.2: 获取对话完整消息列表（分页）
-- 用途: 打开对话时加载消息记录
-- 参数: $1 = conversation_id, $2 = offset, $3 = limit
-- 性能: 使用 idx_messages_conversation_created 索引
SELECT
    m.id,
    m.role,
    m.content,
    m.emotion,
    m.emotion_intensity,
    m.tokens_used,
    m.latency_ms,
    m.metadata,
    m.created_at
FROM messages m
WHERE m.conversation_id = $1
ORDER BY m.created_at ASC
LIMIT $3 OFFSET $2;

-- 查询 1.3: 创建新对话
-- 用途: 用户开始新对话时插入
-- 参数: $1 = user_id, $2 = title, $3 = personality
INSERT INTO conversations (user_id, title, personality)
VALUES ($1, $2, $3)
RETURNING id;

-- 查询 1.4: 归档对话
-- 用途: 用户归档不再活跃的对话
-- 参数: $1 = conversation_id
UPDATE conversations
SET status = 'archived', updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, status;

-- ============================================================
-- 查询类别二: 记忆向量检索（pgvector 核心）
-- ============================================================

-- 查询 2.1: 基于向量相似度检索相关记忆
-- 用途: 助手回答时检索用户相关的历史记忆
-- 参数: $1 = user_id, $2 = 查询向量, $3 = 返回数量 (默认 5), $4 = 相似度阈值 (默认 0.7)
-- 性能: 使用 idx_memories_embedding IVFFlat 索引进行近似最近邻搜索
-- 返回: 记忆内容、相似度分数、情绪标签、亲密度变化
SELECT
    m.id,
    m.content,
    m.summary,
    m.emotion,
    m.intimacy_delta,
    m.memory_type,
    m.importance,
    -- 计算余弦相似度 (1 - distance)，范围 0-1，越接近1越相似
    1 - (m.embedding <=> $2) AS similarity_score,
    m.created_at
FROM memories m
WHERE m.user_id = $1
  -- 过滤低重要性记忆（可选优化条件）
  AND m.importance >= 0.3
  -- 可选: 只检索特定类型的记忆
  -- AND m.memory_type = ANY($5)
ORDER BY m.embedding <=> $2
LIMIT $3;

-- 查询 2.2: 带权重调整的智能记忆检索
-- 用途: 综合考虑相似度、重要性和时效性的记忆检索
-- 参数: $1 = user_id, $2 = 查询向量, $3 = 返回数量
-- 说明: 使用加权评分公式平衡多个因素
WITH scored_memories AS (
    SELECT
        m.id,
        m.content,
        m.summary,
        m.emotion,
        m.intimacy_delta,
        m.memory_type,
        m.importance,
        m.access_count,
        m.last_accessed,
        m.created_at,
        -- 向量相似度 (0-1)
        1 - (m.embedding <=> $2) AS vector_similarity,
        -- 时效性评分: 越新的记忆分越高 (指数衰减)
        EXP(-0.001 * EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - m.created_at)) / 86400.0) AS recency_score,
        -- 访问频率评分: 被频繁访问的记忆更重要
        LEAST(m.access_count / 10.0, 1.0) AS frequency_score
    FROM memories m
    WHERE m.user_id = $1
)
SELECT
    id,
    content,
    summary,
    emotion,
    intimacy_delta,
    memory_type,
    importance,
    access_count,
    -- 综合评分: 相似度 50% + 重要性 20% + 时效性 20% + 访问频率 10%
    (
        0.50 * vector_similarity +
        0.20 * importance +
        0.20 * recency_score +
        0.10 * frequency_score
    ) AS composite_score,
    vector_similarity,
    created_at
FROM scored_memories
ORDER BY composite_score DESC
LIMIT $3;

-- 查询 2.3: 插入新记忆
-- 用途: 对话中提取重要信息后保存为记忆
-- 参数: $1 = user_id, $2 = content, $3 = 向量, $4 = emotion, $5 = intimacy_delta, $6 = summary, $7 = memory_type, $8 = importance
INSERT INTO memories (user_id, content, embedding, emotion, intimacy_delta, summary, memory_type, importance)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id;

-- 查询 2.4: 更新记忆访问计数
-- 用途: 记忆被检索后更新访问统计
-- 参数: $1 = memory_id
UPDATE memories
SET access_count = access_count + 1,
    last_accessed = CURRENT_TIMESTAMP
WHERE id = $1;

-- 查询 2.5: 获取用户最近记忆（按时间）
-- 用途: 展示用户的记忆时间线
-- 参数: $1 = user_id, $2 = limit
SELECT
    m.id,
    m.content,
    m.summary,
    m.emotion,
    m.memory_type,
    m.importance,
    m.access_count,
    m.created_at
FROM memories m
WHERE m.user_id = $1
ORDER BY m.created_at DESC
LIMIT $2;

-- ============================================================
-- 查询类别三: 亲密度系统
-- ============================================================

-- 查询 3.1: 获取用户亲密度信息
-- 用途: 展示用户与助手的关系状态
-- 参数: $1 = user_id
SELECT
    i.id,
    i.user_id,
    i.score,
    i.level,
    i.total_interactions,
    i.total_chat_days,
    i.streak_days,
    i.last_chat_date,
    i.relationship_text,
    i.updated_at,
    -- 计算距离下一等级还需的分数
    CASE
        WHEN i.score < 20 THEN 20 - i.score
        WHEN i.score < 40 THEN 40 - i.score
        WHEN i.score < 60 THEN 60 - i.score
        WHEN i.score < 80 THEN 80 - i.score
        ELSE 100 - i.score
    END AS points_to_next_level,
    -- 下一等级名称
    CASE
        WHEN i.score < 20 THEN 'acquaintance'
        WHEN i.score < 40 THEN 'friend'
        WHEN i.score < 60 THEN 'close_friend'
        WHEN i.score < 80 THEN 'best_friend'
        ELSE 'max_level'
    END AS next_level
FROM intimacy i
WHERE i.user_id = $1;

-- 查询 3.2: 更新亲密度分数
-- 用途: 对话后根据互动质量更新亲密度
-- 参数: $1 = user_id, $2 = delta (变化量), $3 = interaction_increment (互动次数增量)
INSERT INTO intimacy (user_id, score, total_interactions, total_chat_days, streak_days, last_chat_date)
VALUES ($1, GREATEST(0, LEAST(100, $2)), $3, 1, 1, CURRENT_DATE)
ON CONFLICT (user_id) DO UPDATE SET
    score = GREATEST(0, LEAST(100, intimacy.score + $2)),
    total_interactions = intimacy.total_interactions + $3,
    total_chat_days = CASE
        WHEN intimacy.last_chat_date < CURRENT_DATE THEN intimacy.total_chat_days + 1
        ELSE intimacy.total_chat_days
    END,
    streak_days = CASE
        WHEN intimacy.last_chat_date = CURRENT_DATE - 1 THEN intimacy.streak_days + 1
        WHEN intimacy.last_chat_date = CURRENT_DATE THEN intimacy.streak_days
        ELSE 1
    END,
    last_chat_date = CURRENT_DATE,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- 查询 3.3: 获取用户里程碑列表
-- 用途: 展示关系发展时间线
-- 参数: $1 = user_id, $2 = limit
SELECT
    m.id,
    m.type,
    m.title,
    m.description,
    m.intimacy_score_at,
    m.is_notified,
    m.created_at,
    -- 格式化时间显示
    CASE
        WHEN m.created_at > CURRENT_TIMESTAMP - INTERVAL '1 day' THEN '今天'
        WHEN m.created_at > CURRENT_TIMESTAMP - INTERVAL '2 days' THEN '昨天'
        WHEN m.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN '本周'
        WHEN m.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN '本月'
        ELSE TO_CHAR(m.created_at, 'YYYY年MM月DD日')
    END AS time_display
FROM milestones m
WHERE m.user_id = $1
ORDER BY m.created_at DESC
LIMIT $2;

-- 查询 3.4: 创建里程碑
-- 用途: 达成特定条件时创建里程碑记录
-- 参数: $1 = user_id, $2 = type, $3 = title, $4 = description, $5 = intimacy_score_at
INSERT INTO milestones (user_id, type, title, description, intimacy_score_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- ============================================================
-- 查询类别四: 情绪统计与分析
-- ============================================================

-- 查询 4.1: 获取用户最近 N 天的情绪趋势
-- 用途: 情绪分析页面展示趋势图表
-- 参数: $1 = user_id, $2 = 天数 (默认 30)
-- 返回: 按日期和情绪聚合的统计数据
SELECT
    es.date,
    es.emotion,
    es.count,
    es.avg_intensity,
    es.total_messages
FROM emotion_stats es
WHERE es.user_id = $1
  AND es.date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
ORDER BY es.date ASC, es.emotion;

-- 查询 4.2: 获取用户情绪分布汇总
-- 用途: 展示情绪饼图或柱状图
-- 参数: $1 = user_id, $2 = 天数 (默认 30)
SELECT
    es.emotion,
    SUM(es.count) AS total_count,
    AVG(es.avg_intensity) AS avg_intensity,
    -- 占比计算
    ROUND(SUM(es.count)::NUMERIC * 100.0 / NULLIF(SUM(SUM(es.count)) OVER (), 0), 2) AS percentage
FROM emotion_stats es
WHERE es.user_id = $1
  AND es.date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
GROUP BY es.emotion
ORDER BY total_count DESC;

-- 查询 4.3: 获取用户每日情绪主色调
-- 用途: 日历热力图展示每天的主要情绪
-- 参数: $1 = user_id, $2 = 开始日期, $3 = 结束日期
SELECT
    es.date,
    -- 找出当天出现次数最多的情绪
    (SELECT emotion FROM emotion_stats sub
     WHERE sub.user_id = es.user_id AND sub.date = es.date
     ORDER BY sub.count DESC LIMIT 1) AS dominant_emotion,
    SUM(es.total_messages) AS total_messages,
    -- 计算当天的加权平均情绪强度
    SUM(es.count * es.avg_intensity) / NULLIF(SUM(es.count), 0) AS overall_intensity
FROM emotion_stats es
WHERE es.user_id = $1
  AND es.date BETWEEN $2 AND $3
GROUP BY es.date, es.user_id
ORDER BY es.date ASC;

-- 查询 4.4: 聚合或更新情绪统计
-- 用途: 每日定时任务聚合前一天的情绪数据
-- 参数: $1 = user_id, $2 = 统计日期
INSERT INTO emotion_stats (user_id, date, emotion, count, avg_intensity, total_messages)
SELECT
    m.user_id AS user_id,
    DATE(m.created_at) AS date,
    m.emotion,
    COUNT(*) AS count,
    AVG(m.emotion_intensity) AS avg_intensity,
    (SELECT COUNT(*) FROM messages WHERE DATE(created_at) = DATE(m.created_at) AND role = 'user') AS total_messages
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE m.role = 'user'
  AND m.emotion != 'neutral'
  AND c.user_id = $1
  AND DATE(m.created_at) = $2
GROUP BY m.user_id, DATE(m.created_at), m.emotion
ON CONFLICT (user_id, date, emotion) DO UPDATE SET
    count = EXCLUDED.count,
    avg_intensity = EXCLUDED.avg_intensity,
    total_messages = EXCLUDED.total_messages;

-- ============================================================
-- 查询类别五: 药物提醒管理
-- ============================================================

-- 查询 5.1: 获取用户活跃的药物提醒列表
-- 用途: 展示用户的用药提醒设置
-- 参数: $1 = user_id
SELECT
    mr.id,
    mr.medication_name,
    mr.dosage,
    mr.instructions,
    mr.schedule,
    mr.is_active,
    mr.start_date,
    mr.end_date,
    mr.created_at,
    -- 今日是否已服用
    (SELECT COUNT(*) FROM medication_logs ml
     WHERE ml.reminder_id = mr.id
       AND DATE(ml.scheduled_time) = CURRENT_DATE
       AND ml.status = 'taken') > 0 AS taken_today,
    -- 本周服用率
    (SELECT ROUND(
        COUNT(CASE WHEN status = 'taken' THEN 1 END)::NUMERIC * 100.0 / NULLIF(COUNT(*), 0),
        2
    ) FROM medication_logs WHERE reminder_id = mr.id AND scheduled_time > CURRENT_TIMESTAMP - INTERVAL '7 days'
    ) AS weekly_adherence_rate
FROM medication_reminders mr
WHERE mr.user_id = $1
ORDER BY mr.created_at DESC;

-- 查询 5.2: 创建药物提醒
-- 用途: 用户设置新的用药提醒
-- 参数: $1 = user_id, $2 = medication_name, $3 = dosage, $4 = instructions, $5 = schedule (JSONB)
INSERT INTO medication_reminders (user_id, medication_name, dosage, instructions, schedule)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- 查询 5.3: 获取待提醒的药物记录
-- 用途: 定时任务查询即将到期的用药提醒
-- 参数: $1 = 当前时间, $2 = 时间窗口 (如 '15 minutes')
SELECT
    ml.id,
    ml.reminder_id,
    mr.user_id,
    mr.medication_name,
    mr.dosage,
    mr.instructions,
    ml.scheduled_time,
    ml.status,
    u.username,
    u.preferences->>'timezone' AS user_timezone
FROM medication_logs ml
JOIN medication_reminders mr ON ml.reminder_id = mr.id
JOIN users u ON mr.user_id = u.id
WHERE ml.status = 'pending'
  AND ml.scheduled_time BETWEEN $1 AND ($1::TIMESTAMP + $2::INTERVAL)
  AND mr.is_active = true
ORDER BY ml.scheduled_time ASC;

-- 查询 5.4: 记录药物服用
-- 用途: 用户确认已服药后更新记录
-- 参数: $1 = log_id, $2 = status ('taken'/'skipped'), $3 = note
UPDATE medication_logs
SET status = $2,
    taken_time = CASE WHEN $2 = 'taken' THEN CURRENT_TIMESTAMP ELSE NULL END,
    note = $3
WHERE id = $1
RETURNING *;

-- 查询 5.5: 获取药物服用统计
-- 用途: 展示用户的用药依从性报告
-- 参数: $1 = user_id, $2 = 开始日期, $3 = 结束日期
WITH reminder_stats AS (
    SELECT
        mr.id AS reminder_id,
        mr.medication_name,
        mr.dosage,
        COUNT(ml.id) AS total_scheduled,
        COUNT(CASE WHEN ml.status = 'taken' THEN 1 END) AS taken_count,
        COUNT(CASE WHEN ml.status = 'skipped' THEN 1 END) AS skipped_count,
        COUNT(CASE WHEN ml.status = 'late' THEN 1 END) AS late_count,
        COUNT(CASE WHEN ml.status = 'pending' THEN 1 END) AS pending_count,
        -- 服用率
        ROUND(
            COUNT(CASE WHEN ml.status = 'taken' THEN 1 END)::NUMERIC * 100.0 /
            NULLIF(COUNT(CASE WHEN ml.status != 'pending' THEN 1 END), 0),
            2
        ) AS adherence_rate,
        -- 平均延迟时间（分钟）
        ROUND(AVG(
            CASE
                WHEN ml.status IN ('taken', 'late') AND ml.taken_time IS NOT NULL
                THEN EXTRACT(EPOCH FROM (ml.taken_time - ml.scheduled_time)) / 60.0
                ELSE NULL
            END
        )::NUMERIC, 2) AS avg_delay_minutes
    FROM medication_reminders mr
    LEFT JOIN medication_logs ml ON mr.id = ml.reminder_id
        AND DATE(ml.scheduled_time) BETWEEN $2 AND $3
    WHERE mr.user_id = $1
    GROUP BY mr.id, mr.medication_name, mr.dosage
)
SELECT *
FROM reminder_stats
ORDER BY medication_name;

-- ============================================================
-- 查询类别六: 管理与维护查询
-- ============================================================

-- 查询 6.1: 获取系统整体统计
-- 用途: 管理后台仪表盘
SELECT
    (SELECT COUNT(*) FROM users WHERE status = 'active') AS active_users,
    (SELECT COUNT(*) FROM conversations WHERE status = 'active') AS active_conversations,
    (SELECT COUNT(*) FROM messages WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') AS messages_24h,
    (SELECT COUNT(*) FROM memories) AS total_memories,
    (SELECT ROUND(AVG(score)::NUMERIC, 2) FROM intimacy) AS avg_intimacy_score,
    (SELECT COUNT(*) FROM medication_reminders WHERE is_active = true) AS active_medication_reminders,
    (SELECT COUNT(*) FROM medication_logs WHERE scheduled_time > CURRENT_TIMESTAMP - INTERVAL '24 hours') AS medication_logs_24h;

-- 查询 6.2: 获取需要清理的旧数据
-- 用途: 数据保留策略执行
-- 参数: $1 = 消息保留天数 (默认 90)
SELECT
    'messages' AS table_name,
    COUNT(*) AS record_count
FROM messages
WHERE created_at < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
UNION ALL
SELECT
    'conversations' AS table_name,
    COUNT(*) AS record_count
FROM conversations
WHERE status = 'deleted'
  AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
UNION ALL
SELECT
    'medication_logs' AS table_name,
    COUNT(*) AS record_count
FROM medication_logs
WHERE scheduled_time < CURRENT_TIMESTAMP - INTERVAL '365 days';

-- 查询 6.3: 向量索引重建
-- 用途: 记忆数据大量变更后重建 IVFFlat 索引以优化查询性能
-- 注意: 重建期间会锁表，建议在低峰期执行
REINDEX INDEX CONCURRENTLY idx_memories_embedding;

-- 查询 6.4: 记忆衰减 - 降低长期未访问记忆的重要性
-- 用途: 定期任务清理不重要的旧记忆
-- 参数: $1 = 未访问天数阈值 (默认 90), $2 = 衰减系数 (默认 0.1)
UPDATE memories
SET importance = GREATEST(0.1, importance - $2)
WHERE last_accessed < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
  OR (last_accessed IS NULL AND created_at < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL);

-- 查询 6.5: 删除低重要性且长期未访问的记忆
-- 用途: 记忆数量过多时的清理
-- 参数: $1 = 重要性阈值 (默认 0.2), $2 = 未访问天数 (默认 180)
DELETE FROM memories
WHERE importance <= $1
  AND (last_accessed < CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
       OR (last_accessed IS NULL AND created_at < CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL));

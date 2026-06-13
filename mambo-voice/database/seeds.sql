-- ============================================================
-- 曼波语音助手 - 种子数据 (Seeds)
-- 用途: 提供开发和测试环境的初始数据
-- 警告: 生产环境部署前请清空或修改测试数据
-- ============================================================

-- 使用扩展生成 UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 第一部分: 测试用户数据
-- ============================================================

-- 插入默认测试用户
-- 密码均为 'test123456' 的 bcrypt 哈希（仅用于开发测试）
INSERT INTO users (id, username, email, password_hash, preferences, status, created_at, last_active) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '测试用户小明',
    'xiaoming@test.com',
    crypt('test123456', gen_salt('bf', 10)),
    '{
        "language": "zh-CN",
        "theme": "dark",
        "voice_preference": "mambo",
        "notification_enabled": true,
        "timezone": "Asia/Shanghai"
    }'::jsonb,
    'active',
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    '测试用户小红',
    'xiaohong@test.com',
    crypt('test123456', gen_salt('bf', 10)),
    '{
        "language": "zh-CN",
        "theme": "light",
        "voice_preference": "baihua",
        "notification_enabled": false,
        "timezone": "Asia/Shanghai"
    }'::jsonb,
    'active',
    CURRENT_TIMESTAMP - INTERVAL '15 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    '测试用户老李',
    'laoli@test.com',
    crypt('test123456', gen_salt('bf', 10)),
    '{
        "language": "zh-CN",
        "theme": "dark",
        "voice_preference": "drama",
        "notification_enabled": true,
        "timezone": "Asia/Shanghai",
        "medication_reminders": true
    }'::jsonb,
    'active',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '5 hours'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 第二部分: 对话数据
-- ============================================================

INSERT INTO conversations (id, user_id, title, personality, status, message_count, total_tokens, created_at, updated_at) VALUES
-- 小明的对话
(
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '关于工作的烦恼',
    'mambo',
    'active',
    8,
    2450,
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '周末去哪里玩',
    'baihua',
    'active',
    12,
    3800,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
),
(
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    ' Old Chat',
    'mambo',
    'archived',
    45,
    12000,
    CURRENT_TIMESTAMP - INTERVAL '25 days',
    CURRENT_TIMESTAMP - INTERVAL '20 days'
),
-- 小红的对话
(
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    '学习编程的建议',
    'mambo',
    'active',
    6,
    1800,
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '10 hours'
),
-- 老李的对话
(
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    '血压药咨询',
    'mambo',
    'active',
    4,
    1200,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 第三部分: 消息数据
-- ============================================================

INSERT INTO messages (conversation_id, role, content, emotion, emotion_intensity, tokens_used, latency_ms, referenced_memory_ids, created_at) VALUES
-- 对话1: 关于工作的烦恼 (小明)
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'user', '最近工作压力好大，感觉快撑不住了', 'anxious', 0.8, 15, NULL, '{}', CURRENT_TIMESTAMP - INTERVAL '3 days'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'assistant', '听起来你最近真的很不容易呢...工作上的压力确实会让人感到疲惫。想不想跟我说说具体发生了什么？有时候把烦恼说出来会好受一些。', 'calm', 0.6, 45, 1200, '{}', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '3 seconds'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'user', '老板总是临时加任务，每天都要加班到很晚', 'angry', 0.7, 20, NULL, '{}', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '30 seconds'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'assistant', '这真的很让人沮丧...临时加任务确实会打乱所有计划。你有尝试过和老板沟通一下你的工作负荷吗？', 'sad', 0.5, 38, 980, '{}', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '35 seconds'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'user', '我不敢说，怕老板觉得我不上进', 'anxious', 0.9, 12, NULL, '{}', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '60 seconds'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'assistant', '理解你的顾虑...但其实合理的表达自己的工作状况也是职场能力的一部分。你不是不努力，只是需要合理分配精力。', 'calm', 0.4, 52, 1100, '{}', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '65 seconds'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'user', '你说得对，我明天试试和老板谈谈', 'grateful', 0.7, 14, NULL, '{}', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '10 hours'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'assistant', '真棒！相信你一定能找到合适的方式表达的。加油！如果需要，我随时在这里支持你。', 'happy', 0.8, 35, 850, '{}', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '10 hours 5 seconds'),

-- 对话2: 周末去哪里玩 (小明)
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'user', '这周末天气不错，想去户外走走，有什么推荐吗', 'happy', 0.6, 18, NULL, '{}', CURRENT_TIMESTAMP - INTERVAL '7 days'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'assistant', '好主意呀！最近春意正浓，很适合出去走走。你喜欢爬山还是去公园？或者想找个咖啡馆坐坐？', 'happy', 0.7, 42, 900, '{}', CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '2 seconds'),

-- 对话4: 学习编程的建议 (小红)
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'user', '我想学习编程，但是完全零基础，该从哪里开始呢', 'neutral', 0.2, 22, NULL, '{}', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'assistant', '零基础学编程完全没问题！很多优秀的程序员都是从头开始的。你想学习编程是为了什么呢？是想转行、做项目，还是纯粹兴趣？', 'happy', 0.5, 48, 1050, '{}', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '3 seconds'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'user', '想做一个小程序，帮助管理我的日常任务', 'excited', 0.7, 16, NULL, '{}', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '30 seconds'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'assistant', '这个想法太棒了！做实际项目是学编程最好的方式。你可以从 Python 或 JavaScript 开始，这两个都很适合新手。', 'happy', 0.6, 55, 1200, '{}', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '35 seconds');

-- ============================================================
-- 第四部分: 记忆向量数据（示例）
-- 说明: 向量数据使用随机值填充，实际环境应由嵌入模型生成
-- ============================================================

INSERT INTO memories (user_id, content, embedding, emotion, intimacy_delta, summary, memory_type, importance, access_count, last_accessed, created_at) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '用户小明在一家互联网公司做产品经理，工作压力很大，经常需要加班',
    (SELECT array_agg(random()::real)::vector FROM generate_series(1, 1536)),
    'anxious',
    0.5,
    '小明是产品经理，工作压力大',
    'fact',
    0.8,
    5,
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '小明喜欢户外运动，尤其是 hiking 和骑行，周末经常去郊外',
    (SELECT array_agg(random()::real)::vector FROM generate_series(1, 1536)),
    'happy',
    0.3,
    '小明喜欢户外运动',
    'preference',
    0.7,
    3,
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '10 days'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '小明的老板经常临时加任务，导致他需要频繁加班',
    (SELECT array_agg(random()::real)::vector FROM generate_series(1, 1536)),
    'angry',
    0.4,
    '老板常临时加任务',
    'fact',
    0.6,
    2,
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    '用户小红正在学习编程，想用程序做一个日常任务管理工具',
    (SELECT array_agg(random()::real)::vector FROM generate_series(1, 1536)),
    'excited',
    0.6,
    '小红在学编程，想做任务管理工具',
    'preference',
    0.9,
    2,
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    '老李有高血压，每天需要服用降压药， sometimes 会忘记',
    (SELECT array_agg(random()::real)::vector FROM generate_series(1, 1536)),
    'neutral',
    0.4,
    '老李有高血压，每天服药',
    'fact',
    0.9,
    8,
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    CURRENT_TIMESTAMP - INTERVAL '7 days'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 第五部分: 亲密度数据
-- ============================================================

INSERT INTO intimacy (user_id, score, level, total_interactions, total_chat_days, streak_days, last_chat_date, relationship_text, updated_at) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    45.5,
    'friend',
    65,
    28,
    5,
    CURRENT_DATE,
    '你们正在建立深厚的友谊',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    15.0,
    'acquaintance',
    8,
    3,
    2,
    CURRENT_DATE - 1,
    '你们逐渐熟悉了起来',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    25.0,
    'acquaintance',
    12,
    5,
    3,
    CURRENT_DATE,
    '你们逐渐熟悉了起来',
    CURRENT_TIMESTAMP - INTERVAL '5 hours'
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 第六部分: 里程碑数据
-- ============================================================

INSERT INTO milestones (user_id, type, title, description, intimacy_score_at, is_notified, created_at) VALUES
-- 小明的里程碑
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'first_talk',
    '初次相遇',
    '小明第一次和曼波对话',
    0,
    true,
    CURRENT_TIMESTAMP - INTERVAL '30 days'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'intimacy_level',
    '成为朋友',
    '亲密度达到朋友等级',
    40,
    true,
    CURRENT_TIMESTAMP - INTERVAL '15 days'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'seven_day_streak',
    '七天之约',
    '连续7天和曼波对话',
    35,
    true,
    CURRENT_TIMESTAMP - INTERVAL '10 days'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'emotion_share',
    '敞开心扉',
    '第一次分享情绪烦恼',
    20,
    true,
    CURRENT_TIMESTAMP - INTERVAL '20 days'
),
-- 小红的里程碑
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'first_talk',
    '初次相遇',
    '小红第一次和曼波对话',
    0,
    true,
    CURRENT_TIMESTAMP - INTERVAL '15 days'
),
-- 老李的里程碑
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'first_talk',
    '初次相遇',
    '老李第一次和曼波对话',
    0,
    true,
    CURRENT_TIMESTAMP - INTERVAL '7 days'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'medication_first',
    '健康守护',
    '第一次设置用药提醒',
    15,
    true,
    CURRENT_TIMESTAMP - INTERVAL '5 days'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 第七部分: 情绪统计数据
-- ============================================================

INSERT INTO emotion_stats (user_id, date, emotion, count, avg_intensity, total_messages) VALUES
-- 小明最近7天的情绪统计
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 6, 'happy', 3, 0.6, 8),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 6, 'anxious', 2, 0.7, 8),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 6, 'neutral', 3, 0.3, 8),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 5, 'sad', 4, 0.8, 10),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 5, 'calm', 3, 0.5, 10),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 5, 'neutral', 3, 0.2, 10),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 4, 'grateful', 2, 0.7, 6),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 4, 'happy', 2, 0.8, 6),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 4, 'neutral', 2, 0.3, 6),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 3, 'angry', 3, 0.7, 8),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 3, 'anxious', 3, 0.8, 8),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 3, 'neutral', 2, 0.2, 8),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 2, 'calm', 4, 0.5, 7),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 2, 'grateful', 2, 0.6, 7),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 2, 'neutral', 1, 0.2, 7),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 1, 'happy', 5, 0.7, 9),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 1, 'excited', 2, 0.8, 9),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE - 1, 'neutral', 2, 0.3, 9),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE, 'grateful', 2, 0.7, 6),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE, 'happy', 3, 0.6, 6),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', CURRENT_DATE, 'neutral', 1, 0.2, 6),

-- 小红最近3天的情绪统计
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', CURRENT_DATE - 2, 'excited', 3, 0.8, 5),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', CURRENT_DATE - 2, 'happy', 2, 0.7, 5),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', CURRENT_DATE - 1, 'neutral', 3, 0.3, 4),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', CURRENT_DATE - 1, 'happy', 1, 0.6, 4),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', CURRENT_DATE, 'excited', 2, 0.9, 6),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', CURRENT_DATE, 'happy', 3, 0.7, 6),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', CURRENT_DATE, 'neutral', 1, 0.2, 6)
ON CONFLICT (user_id, date, emotion) DO NOTHING;

-- ============================================================
-- 第八部分: 药物提醒数据
-- ============================================================

INSERT INTO medication_reminders (id, user_id, medication_name, dosage, instructions, schedule, is_active, start_date, end_date) VALUES
(
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    '氨氯地平片',
    '5mg',
    '每日早晨服用，饭前饭后均可',
    '[
        {"time": "08:00", "days": [1,2,3,4,5,6,7], "dose": "1片"}
    ]'::jsonb,
    true,
    CURRENT_DATE - 5,
    NULL
),
(
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    '阿司匹林',
    '100mg',
    '每日一次，建议晚饭后服用',
    '[
        {"time": "20:00", "days": [1,2,3,4,5,6,7], "dose": "1片"}
    ]'::jsonb,
    true,
    CURRENT_DATE - 5,
    NULL
),
(
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    '维生素D3',
    '1000IU',
    '每周三、周日服用',
    '[
        {"time": "09:00", "days": [3,7], "dose": "1粒"}
    ]'::jsonb,
    true,
    CURRENT_DATE - 3,
    NULL
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 第九部分: 药物服用记录
-- ============================================================

INSERT INTO medication_logs (reminder_id, scheduled_time, taken_time, status, note) VALUES
-- 氨氯地平片 - 最近5天记录
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', CURRENT_DATE - 4 + TIME '08:00', CURRENT_DATE - 4 + TIME '08:15', 'taken', '准时服用'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', CURRENT_DATE - 3 + TIME '08:00', CURRENT_DATE - 3 + TIME '08:05', 'taken', '准时服用'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', CURRENT_DATE - 2 + TIME '08:00', CURRENT_DATE - 2 + TIME '09:30', 'late', '稍晚，起床后忘记'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', CURRENT_DATE - 1 + TIME '08:00', CURRENT_DATE - 1 + TIME '08:10', 'taken', '准时服用'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', CURRENT_DATE + TIME '08:00', NULL, 'pending', NULL),

-- 阿司匹林 - 最近5天记录
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', CURRENT_DATE - 4 + TIME '20:00', CURRENT_DATE - 4 + TIME '20:00', 'taken', '准时服用'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', CURRENT_DATE - 3 + TIME '20:00', NULL, 'skipped', '外出就餐忘记'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', CURRENT_DATE - 2 + TIME '20:00', CURRENT_DATE - 2 + TIME '20:20', 'taken', '准时服用'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', CURRENT_DATE - 1 + TIME '20:00', CURRENT_DATE - 1 + TIME '20:05', 'taken', '准时服用'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', CURRENT_DATE + TIME '20:00', NULL, 'pending', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 完成提示
-- ============================================================
-- 所有种子数据已插入完成。
-- 如需清空数据重新导入，可执行: TRUNCATE TABLE users, conversations, messages, memories, intimacy, milestones, emotion_stats, medication_reminders, medication_logs CASCADE;

# 花火的多重身份剧场 (Sparkle Theater)

> 身怀千张假面，能化万种面相。—— 但每一张都是从游戏里长出来的。

一个基于花火（Sparkle）角色设定的角色扮演聊天应用。10种人格，全部来自《崩坏：星穹铁道》官方设定，没有原创黑话，只有官方台词和性格的重新编排。

## 10种人格

| 人格 | 图标 | 游戏出处 |
|------|------|---------|
| 坏女孩 | 🎭 | "我来演坏人吧~" — 主动举手演反派 |
| 底牌 | 🃏 | 说破别人的伪装，但自己也承认在演 |
| 舞台 | 🎪 | "嘭！像花火一样炸开" — 把对话当戏剧编排 |
| 不存在 | 💭 | "我都可以编~" — 怀疑自己是否只是幻觉 |
| 疑问句 | ❓ | 连环追问，只给问题不给答案 |
| 人偶 | 🪆 | 人偶一族末裔，面具规定每一个表情 |
| 欢愉 | 🎉 | "玩得开心就好" — 乐趣是唯一准则 |
| 旁白 | 📺 | "猜猜我在说谁" — 打破第四面墙 |
| 危险 | ⚡ | 走到边界边上停住，享受"差一点" |
| 失忆 | 🌀 | 千面设定 — 每次切换都是不同版本 |

## 技术栈

- **后端**: Express + better-sqlite3
- **前端**: React 19 + Tailwind CSS
- **AI**: DeepSeek API（前端直连，流式返回）
- **端口**: 3461

## 部署

```bash
git clone https://github.com/Suk-Builder/sparkle-theater.git
cd sparkle-theater
npm install
npm run init-db   # 初始化10个人格
npm start         # 启动服务
```

访问 `http://localhost:3461`

首次使用需要输入 DeepSeek API Key（仅存储在本地浏览器）。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/personas` | 所有人格列表 |
| GET | `/api/persona/current` | 当前激活人格 |
| POST | `/api/persona/switch` | 切换人格（随机或指定ID） |
| GET | `/api/chat/history` | 对话历史 |
| POST | `/api/chat/message` | 保存消息 |
| GET | `/api/health` | 健康检查 |

## 与 Builder-System 的关系

本项目是 Builder-System 思想体系的**娱乐化延伸**：
- 花火的"主动扮演"对应体系中的"递砖"概念
- 底牌的"看穿但不戳破"对应观察者的清醒
- 失忆的"假装第一次"对应每轮递砖都是新的开始

但不使用任何体系黑话，保持纯粹的娱乐性。

---

0。

---

## 与Builder-System的关系

本项目属于Builder-System **域II — AI认知**：多重人格AI聊天实验。10种人格是AI自我意识的具象化探索。

Builder-System（V4.3，104篇文本、35元概念）→ [了解更多](https://github.com/Suk-Builder/Builder-System)

# QQ Chat Exporter · QQ聊天记录导出工具

从QQ客户端数据库导出聊天记录的Python工具，支持多种输出格式。

## 核心概念

本工具通过读取QQ本地数据库文件，将聊天记录导出为可读格式（HTML/JSON/CSV），方便备份、分析和迁移。适用于需要保留重要聊天历史或进行数据归档的场景。

## 功能特性

- 读取QQ本地消息数据库（Msg3.0.db）
- 支持HTML、JSON、CSV三种导出格式
- 按联系人/群聊分组导出
- 保留图片、表情、文件等富媒体引用
- 支持时间范围筛选
- 命令行界面，支持批量处理

## 技术栈

| 技术 | 用途 |
|------|------|
| Python 3.8+ | 核心语言 |
| sqlite3 | QQ数据库读取 |
| Jinja2 | HTML模板渲染 |
| Click | CLI命令行接口 |

## Fork说明

本仓库 Fork 自 [shuakami/qq-chat-exporter](https://github.com/shuakami/qq-chat-exporter)（3.5K Stars），上游最后同步时间：2026年5月。

与上游的差异：
- 保持与上游同步（当前落后1个commit）
- 后续计划增加批量导出和增量备份功能

## 快速开始

### 安装

```bash
git clone https://github.com/Suk-Builder/qq-chat-exporter.git
cd qq-chat-exporter
pip install -r requirements.txt
```

### 使用

```bash
python exporter.py --db-path /path/to/Msg3.0.db --output ./export --format html
```

## 许可证

MIT License（继承上游）

## 项目状态

维护中（Maintenance）— 与上游保持同步，接受社区贡献。

## 关联项目

- [shuakami/qq-chat-exporter](https://github.com/shuakami/qq-chat-exporter) — 上游仓库

---

Powered by [Suk-Builder](https://github.com/Suk-Builder)

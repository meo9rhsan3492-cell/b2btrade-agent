# Changelog

## [2.0.0] - 2026-04-09

### 新增功能

#### LLM Agent 增强系统 (P0-P3)

##### P0: 询盘情报员 (inquiry-intel-agent)
- 智能询盘分类：高价值 / 真实客户 / 垃圾 / 竞品套价 / 未知
- 置信度评分 (0-100%)
- 买家画像提取：类型、决策链、预算、时间线
- 风险信号识别
- 规则引擎 Fallback（LLM 不可用时降级）
- **CLI**: `node src/index.js inquiry "John, ABC Corp, need excavators"`

##### P1: 回复专家 (reply-agent)
- 基于询盘分类生成个性化邮件
- 多语气支持：professional / friendly / formal / casual
- 自动卖点提取
- CTA 行动号召生成
- **CLI**: `node src/index.js reply --inquiry "John, ABC Corp, need excavators"`

##### P2: 跟进管家 (followup-agent)
- 自动生成跟进序列（Day 1/3/7/14...）
- 持久化存储：`~/.b2btrade-followups.json`
- 状态追踪：pending / sent / accepted / rejected
- **CLI**: `node src/index.js followup --inquiry "John, ABC Corp, need excavators"`

##### P3: LinkedIn 外展 (linkedin-agent)
- 目标决策者搜索（采购/CEO/项目经理）
- 个性化连接请求消息生成
- 外展列表管理
- **CLI**:
  - `node src/index.js linkedin --search "excavator buyer"`
  - `node src/index.js linkedin --outreach "John" --company "ABC Corp"`

##### Pipeline 编排 (pipeline-agent)
- 一键串联：分类 → 邮件 → 跟进
- 工作流历史记录
- **CLI**: `node src/index.js pipeline "John, ABC Corp, need excavators"`

### 技术改进

- **Orchestrator 层** (`orchestrator.js`)
  - 自动清理 `<thinking>` 标签
  - 多级重试 + 指数退避
  - 结构化 JSON 输出（强制 Schema）
  - 支持多 Provider：OpenAI / MiniMax / Anthropic / Google

- **模型支持**
  - MiniMax M2.7-highspeed（推荐）
  - MiniMax M2.7 / M2.5
  - OpenAI GPT-4 / GPT-3.5
  - Anthropic Claude
  - Google Gemini

### 文件结构

```
src/agents/
├── orchestrator.js       # LLM 调用层
├── inquiry-intel-agent.js # P0 询盘分类
├── reply-agent.js         # P1 邮件生成
├── followup-agent.js     # P2 跟进管理
├── linkedin-agent.js     # P3 LinkedIn 外展
└── pipeline-agent.js     # Pipeline 编排
```

### 数据存储

| 文件 | 内容 |
|------|------|
| `~/.b2btrade-agent.json` | API 配置 |
| `~/.b2btrade-followups.json` | 跟进计划 |
| `~/.b2btrade-linkedin.json` | LinkedIn 外展列表 |
| `~/.b2btrade-pipeline.json` | Pipeline 历史 |

---

## [1.0.0] - 2026-03-16

### 初始版本
- 12 位外贸专家 Agent
- 工具集成（Shopify / 1688 / TikTok / Instagram）
- 基础工作流

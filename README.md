﻿# B2Btrade Agent 🤖

**AI-Powered B2B Foreign Trade Automation — From Prospect to Payment**

```
> 输入: "帮我找沙特的钻机采购商，写一封开发信"
> 输出: ✅ 找到42家潜在采购商 + 定制化开发信模板 (30秒)
```

[![npm version](https://img.shields.io/npm/v/b2btrade-agent?style=flat-square)](https://www.npmjs.com/package/b2btrade-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/Node.js-%3E%3D18-green?style=flat-square)](https://nodejs.org/)
[![CI](https://github.com/meo9rhsan3492-cell/b2btrade-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/meo9rhsan3492-cell/b2btrade-agent/actions/workflows/ci.yml)

---

## 🎯 痛点

外贸人每天在做这些耗时的事：
- 🔍 **客户挖掘** — Google 搜索、海关数据、LinkedIn，一个一个找
- ✉️ **写开发信** — 写了几十封，回复率还是低于 2%
- 📊 **分析询盘** — 不知道客户是真是假，报价没底气
- 💰 **市场调研** — 竞品在做什么，一无所知

**B2Btrade Agent** 把这些全部自动化。你做决策，AI 执行。

---



## 🆕 v1.1.0 新功能 (2026-03-25)

### 👥 CRM 客户管理
```
b2b crm dashboard       # 仪表盘（管道金额/阶段分布/逾期提醒）
b2b crm add <公司>    # 添加客户
b2b crm get <id>     # 查看详情 + 跟进历史
b2b crm interact <id> call <内容>   # 添加跟进记录
b2b crm remind <id> <内容> [天数]   # 设置下次跟进提醒
b2b crm reminders     # 查看逾期/即将到期提醒
```

### 📧 邮件跟进序列
```
b2b sequence create cold_outreach [产品] [国家]  # 创建开发信序列
b2b sequence gen <id>    # AI生成5封邮件内容
b2b sequence export <id>  # 导出CSV
```
- 4套模板: Cold Outreach / RFQ跟进 / 展会跟进 / LinkedIn转化
- 支持 Day1/3/7/14/25 自动触达节奏

### 🏛️ 展会全流程
```
b2b show add <展会名> <日期> <地点>  # 创建展会
b2b show lead <id> quality=4 email=x@corp.com company=ABC  # 收集名片
b2b show leads <id>   # 查看展会线索
b2b show tasks <id>   # 展后72h任务清单
```
- 展前竞品调研（AI生成）
- 线索质量分级（1-5星）
- 展后自动创建跟进序列

### 🛡️ 外贸合规工具
- OFAC/BIS/UN制裁名单筛查
- 高风险国家预警（伊朗/朝鲜/叙利亚等）
- BLOCK / REVIEW / CAUTION / CLEAR 四级结论

### 📊 专业报价工具
- HS编码查询（出口退税率+监管条件）
- Incoterms 2020成本计算器（FOB/CIF/DDP）
- 专业PI报价单生成（Markdown/HTML）

---

## ✨ 为什么用这个？

| 功能 | B2Btrade Agent | 传统方式 |
|------|----------------|---------|
| 找客户 | 30秒 42家潜在采购商 | 2-3小时手动搜索 |
| 写开发信 | 基于真实采购数据定制 | 套模板，千篇一律 |
| 分析询盘 | AI 识别真实需求+报价建议 | 凭经验猜 |
| 市场调研 | 全网聚合分析，5分钟出报告 | 查一天 |

**19个专家Agent × 4个自动化工作流 × 多模型支持**

---

## 🚀 30秒上手

```bash
# 1. 安装 (Node.js >= 18)
npm install -g b2btrade-agent

# 2. 配置 (首次运行按提示输入 API Key)
b2b config

# 3. 开始用
b2b chat                    # 对话模式
b2b run find-email 沙特 钻机  # 自动找客户+写开发信
```

**支持 OpenAI / Claude / Gemini / MiniMax**，用你自己的 API Key，数据全在本地。

---

## 💡 使用场景

### 对话模式 — 随便问

```bash
$ b2b chat

🤖: 你好！我是B2B贸易AI助手

> 帮我分析这个询盘：客户要5台200米钻机，交期60天
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 询盘分析报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 真实性: 高 (具体数量+交期=真实采购意向)
💰 建议报价区间: $85,000-$92,000/台
⚠️ 风险点: 交期60天较紧，确认原材料库存
📝 还价策略: 先报$95,000，留还价空间
🔗 关联产品: 钻杆、钻头配件（追加销售机会）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> 中东钻机市场趋势怎么样
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 中东钻机市场简报 (2024Q4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 沙特+阿联酋+卡塔尔 占海湾地区70%采购量
• 增长动力: Vision 2030 基础设施投资
• 主要采购国: 美国(40%)、中国(30%)、德国(15%)
• 热门规格: 200-300米履带式钻机 ↑18%
• 竞争对手: 徐工、三一、重汽报价最具竞争力
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 工作流模式 — 全自动

```bash
# 客户挖掘 → 开发信 一键完成
$ b2b run find-email 沙特 钻机

🔍 [00:00] 正在搜索目标采购商...
   ✅ 找到 42 家潜在采购商
   ✅ 验证邮箱 38 家有效
   ✅ 筛选高匹配度客户 15 家

✉️  [00:18] 正在生成个性化开发信...
   ✅ 生成 15 封定制化开发信
   ✅ 存储至 ./output/cold-emails-2026-03-23.md

📊 [00:23] 完成！
   • 高优先级客户: 5 家 (直接联系)
   • 中优先级客户: 7 家 (LinkedIn 触达)
   • 建议跟进: 3 家 (等待展会后联系)

输出文件: ./output/cold-emails-2026-03-23.md
```

---

## 🤖 19个专家Agent

| Agent | 做什么 |
|-------|--------|
| 🎯 **客户情报官** | 挖掘潜在采购商，验证邮箱，评估匹配度 |
| ✍️ **内容创作者** | 开发信、LinkedIn帖子、产品描述 |
| 🚀 **增长黑客** | Google Ads、展会策略、获客渠道 |
| 🔍 **SEO专家** | 关键词研究、竞品分析、Google排名 |
| 📱 **社媒运营** | LinkedIn、Facebook、行业社区运营 |
| 🧩 **询盘专家** | 询盘分析、报价策略、还价应对 |
| 📊 **销售分析** | 业绩追踪、客户分层、ROI分析 |
| 💬 **客服支持** | 售后跟进、复购激活、客户维护 |
| 🚢 **物流专家** | 货代对比、海运/空运方案 |
| 📋 **报关顾问** | HS编码、退税、贸易条款 |
| 🤝 **谈判专家** | 价格谈判、合同条款、风险控制 |
| 💰 **财务顾问** | 外汇结算、信用证、收汇保障 |
| 💼 **LinkedIn 外展** | 个性化连接请求/私信草稿 |
| 📱 **WhatsApp 外展** | 多语言消息（中/英/阿/西/法） |
| 📧 **Email 外展** | 开发信/跟进邮件/报价邮件 |
| 🛒 **Shopify 助手** | 订单处理、发货通知 |
| 🏪 **Ali1688 助手** | 货源搜索、供应商信息 |
| 🎵 **TikTok 助手** | 商品列表、产品描述生成 |
| 📸 **Instagram 助手** | 推广文案、图片描述 |

---

## 🔧 高级配置

### 多模型支持

```bash
# 设置默认模型
b2b config set model claude-3-sonnet

# 或者在代码中
{
  "provider": "anthropic",   // openai | anthropic | google | minimax
  "model": "claude-3-sonnet",
  "apiKey": "sk-..."
}
```

### 自定义工作流

```javascript
// b2btrade-agent/workflows/custom.js
export default {
  name: "我的工作流",
  steps: [
    { agent: "客户情报官", task: "找德国机械采购商" },
    { agent: "内容创作者", task: "生成德语开发信" },
    { agent: "询盘专家", task: "制定跟进策略" }
  ]
}
```

---

## 📂 项目结构

```
b2btrade-agent/
├── src/
│   ├── agents/          # 13个专家Agent定义
│   ├── tools/            # 搜索、邮箱验证等工具
│   ├── workflows/       # 自动化工作流
│   ├── utils/           # 重试、限流、会话管理
│   ├── ai.js            # 多模型API抽象层
│   ├── config.js        # 配置管理
│   └── index.js         # CLI入口
├── package.json
└── README.md
```

---

## 🛡️ 安全说明

- API Key 仅保存在 `~/.b2btrade-agent.json`，不提交到 Git
- 所有数据处理在本地完成，不经过第三方服务器
- 支持代理模式，适合企业内网环境

---

## 📦 安装

```bash
npm install -g b2btrade-agent

# 或者克隆开发
git clone https://github.com/meo9rhsan3492-cell/b2btrade-agent.git
cd b2btrade-agent
npm install
```

---

## 🤝 贡献

Issues 和 PR 欢迎！也可以提交新的 Agent 定义或工作流。

---

## 📄 License

MIT

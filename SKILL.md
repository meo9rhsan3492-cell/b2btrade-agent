---
name: b2btrade-agent
description: 外贸B2B智能Agent - AI驱动的外贸获客、内容创作、多平台外展自动化工具，支持客户挖掘、开发信、LinkedIn/WhatsApp/Email多渠道外展
version: 1.1.0
---

# B2Btrade Agent

AI驱动的外贸B2B自动化工具，一个CLI让外贸人用自然语言完成客户挖掘、开发信撰写、多平台外展全流程。

## 快速开始

```bash
# 安装
npm install -g b2btrade-agent

# 配置 API Key（支持 OpenAI / Claude / Gemini / MiniMax）
b2b config

# 对话模式
b2b chat

# 客户挖掘 → 开发信
b2b run find-email 沙特 钻机

# 询盘分析
b2b run rfq-quote 客户要5台200米钻机
```

## 核心命令

| 命令 | 说明 |
|------|------|
| `b2b chat [agent]` | 对话模式，可指定Agent |
| `b2b list` | 列出所有Agent |
| `b2b run find-email <国家> <产品>` | 客户挖掘+开发信 |
| `b2b run rfq-quote <询盘内容>` | 询盘分析+报价单 |
| `b2b search <关键词>` | 快速客户搜索 |
| `b2b config` | 配置API Key |
| `b2b status` | 查看运行状态和统计 |

## 19个专家Agent

| Agent ID | 名称 | 用途 |
|----------|------|------|
| intelligence | 🎯 客户情报官 | 海关数据+LinkedIn找采购商 |
| content | ✍️ 内容创作者 | 开发信、LinkedIn帖子 |
| growth | 🚀 增长黑客 | Google Ads、展会策略 |
| seo | 🔍 SEO专家 | 关键词研究 |
| social | 📱 社媒运营 | LinkedIn/Facebook |
| rfq | 🧩 询盘专家 | 询盘分析、报价策略 |
| sales | 📊 销售分析 | 客户分级 |
| support | 💬 客服支持 | 售后跟进 |
| logistics | 🚢 物流专家 | 海运/空运方案 |
| customs | 📋 报关顾问 | HS编码、退税 |
| negotiation | 🤝 谈判专家 | 价格谈判 |
| finance | 💰 财务顾问 | 外汇结算 |
| linkedin | 💼 LinkedIn外展 | 个性化连接请求 |
| whatsapp | 📱 WhatsApp外展 | 多语言消息 |
| email | 📧 Email外展 | 开发信跟进 |
| shopify | 🛒 Shopify助手 | 订单管理 |
| ali1688 | 🏪 1688助手 | 货源搜索 |
| tiktok | 🎵 TikTok助手 | 直播话术 |
| instagram | 📸 Instagram助手 | 推广文案 |

## 多模型支持

支持 OpenAI / Anthropic Claude / Google Gemini / MiniMax，自带令牌桶限流保护。

## 工作流自动化

```bash
# 客户挖掘+开发信
b2b run find-email 沙特 钻机

# 询盘到报价单
b2b run rfq-quote 5台200米钻机

# 市场调研
b2b run market-research 中东 钻机
```

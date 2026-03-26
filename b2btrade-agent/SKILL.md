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
| `b2b list` | 列出所有13个专家Agent |
| `b2b run find-email <国家> <产品>` | 客户挖掘+开发信 |
| `b2b run rfq-quote <询盘内容>` | 询盘分析+报价单 |
| `b2b run market-research <国家> <产品>` | 市场调研报告 |
| `b2b search <关键词>` | 快速客户搜索 |
| `b2b config` | 配置API Key |
| `b2b status` | 查看运行状态和统计 |

## 13个专家Agent

| Agent ID | 名称 | 用途 |
|----------|------|------|
| intelligence | 🎯 客户情报官 | 海关数据+LinkedIn+Google找采购商 |
| content | ✍️ 内容创作者 | 开发信、LinkedIn帖子、产品描述 |
| growth | 🚀 增长黑客 | Google Ads、展会策略 |
| seo | 🔍 SEO专家 | 关键词研究、竞品监控 |
| social | 📱 社媒运营 | LinkedIn/Facebook运营 |
| rfq | 🧩 询盘专家 | 询盘分析、报价策略 |
| sales | 📊 销售分析 | 客户分级、业绩追踪 |
| support | 💬 客服支持 | 售后跟进、复购激活 |
| logistics | 🚢 物流专家 | 海运/空运方案、货代对比 |
| customs | 📋 报关顾问 | HS编码、退税、出口合规 |
| negotiation | 🤝 谈判专家 | 价格谈判、合同条款 |
| finance | 💰 财务顾问 | 外汇结算、信用证、收汇 |
| linkedin | 💼 LinkedIn外展 | 个性化连接请求/私信 |
| whatsapp | 📱 WhatsApp外展 | 多语言消息（中/英/阿/西/法） |
| email | 📧 Email外展 | 开发信/跟进邮件/报价邮件 |
| shopify | 🛒 Shopify助手 | 订单管理、发货通知 |
| ali1688 | 🏪 1688助手 | 货源搜索、供应商对比 |
| tiktok | 🎵 TikTok助手 | 商品列表、直播话术 |
| instagram | 📸 Instagram助手 | 商业账户运营、推广文案 |

## 对话示例

```
> b2b chat

🤖: B2Btrade Agent 就绪

> 帮我分析这个询盘：客户要5台200米钻机，交期60天

📋 询盘分析报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 真实性: 高（具体数量+交期=真实采购意向）
💰 建议报价区间: $85,000-$92,000/台
⚠️ 风险点: 交期60天较紧，确认原材料库存
📝 还价策略: 先报$95,000，留还价空间
🔗 关联产品: 钻杆、钻头配件（追加销售机会）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> 中东钻机市场趋势怎么样

📊 中东钻机市场简报
• 沙特+阿联酋+卡塔尔占海湾地区70%采购量
• Vision 2030基础设施投资驱动增长
• 热门规格: 200-300米履带式钻机 ↑18%
```

## 多模型支持

```bash
# 配置默认模型
b2b config set model claude-3-sonnet

# 代码中使用
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "apiKey": "sk-..."
}
```

## 工作流自动化

```bash
# 一键客户挖掘+开发信
b2b run find-email 沙特 钻机

# 询盘到报价单
b2b run rfq-quote 5台200米钻机 交期60天

# 市场调研
b2b run market-research 中东 钻机
```

## 技术特性

- **令牌桶限流**：多平台独立限流，支持自适应退避
- **智能重试**：429限流自动等待重试
- **会话历史**：支持多轮对话上下文
- **批量处理**：chatBatch支持批量生成
- **本地存储**：API Key存在本地，不上传服务器
- **多语言**：支持中文/英文/阿拉伯语/西班牙语/法语输出

## 输出示例（find-email工作流）

```
🔍 [00:05] 正在搜索目标采购商...
   ✅ 找到 42 家潜在采购商
   ✅ 验证邮箱 38 家有效
   ✅ 筛选高匹配度客户 15 家

✉️  [00:22] 正在生成个性化开发信...
   ✅ 生成 15 封定制化开发信
   ✅ 存储至 ./output/cold-emails-2026-03-25.md

📊 [00:28] 完成！
   • 高优先级客户: 5 家
   • 中优先级客户: 7 家
   • 建议跟进: 3 家
```

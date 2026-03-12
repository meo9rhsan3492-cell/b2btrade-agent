# B2Btrade-agent 🤖

> 外贸B2B智能Agent - 开箱即用的外贸AI助手

一个专为外贸从业者打造的命令行AI工具，让每个人都能拥有15年外贸老鸟的经验。

## ⭐ 简介

B2Btrade-agent 是一个**开箱即用的外贸AI助手**，旨在帮助外贸企业：
- 🎯 快速挖掘目标客户
- ✍️ 生成高回复率开发信
- 📊 专业分析询盘与报价
- 📈 获取市场情报

不需要编程基础，会用命令行就能上手。

## ✨ 特性

- **9位外贸专家** - 客户挖掘、内容创作、SEO优化、询盘处理、报价策略...
- **自动化工作流** - 客户挖掘→开发信、询盘分析→报价、市场调研
- **多模型支持** - OpenAI / Claude / Gemini / Minimax
- **工具扩展** - 可接入浏览器搜索、海关数据等

## 🚀 快速开始

### 安装

```bash
git clone https://github.com/meo9rhsan3492-cell/b2btrade-agent.git
cd b2btrade-agent
npm install
```

### 配置API Key

首次使用需要配置 API Key，运行以下命令并按提示操作：

```bash
node src/index.js config
```

支持的 API 提供商：
- OpenAI (GPT-4)
- Minimax
- Anthropic (Claude)
- Google (Gemini)

**注意：API Key 仅保存在本地 `~/.b2btrade-agent.json`，不会提交到 Git**

### 开始使用

```bash
# 对话模式
node src/index.js chat

# 查看所有Agent
node src/index.js list

# 执行工作流
node src/index.js run find-email 沙特 钻机
```

## 📖 使用方式

### 对话模式

```bash
$ b2b chat
> 帮我写一封针对沙特采购商的开发信
> 分析一下这个询盘：客户想要5台200米钻机
> 中东市场趋势怎么样
```

### Agent切换

```bash
> /list              # 查看所有Agent
> /agent content     # 切换到内容专家
> /agent rfq         # 切换到询盘专家
```

### 工作流

| 工作流 | 用途 | 命令 |
|--------|------|------|
| 客户挖掘→开发信 | 从0找到客户并写开发信 | `b2b run find-email 沙特 钻机` |
| 询盘分析→报价 | 分析询盘生成报价单 | `b2b run rfq-quote <询盘内容>` |
| 市场调研 | 目标市场全面分析 | `b2b run market-research 中东 钻机` |

## 🤖 可用Agent

| Agent | 功能 |
|-------|------|
| 🤖 通用顾问 | 全流程问题解答 |
| 🎯 客户情报官 | 挖掘潜在采购商 |
| ✍️ 内容创作者 | 开发信、社媒内容 |
| 🚀 增长黑客 | Google Ads、展会获客 |
| 🔍 SEO专家 | 关键词研究、站点优化、排名 |
| 📱 社媒运营 | LinkedIn、Facebook运营 |
| 📊 销售分析 | 客户管理、业绩分析 |
| 🧩 询盘专家 | 询盘分析、报价策略 |
| 💬 客服支持 | 售后维护、复购 |
| 🧩 询盘专家 | 询盘分析、报价策略 |
| 💬 客服支持 | 售后维护、复购 |

## 🔧 配置

配置文件位于: `~/.b2btrade-agent.json`

```json
{
  "apiProvider": "openai",
  "apiKey": "your-api-key",
  "model": "gpt-4"
}
```

支持的模型:
- **OpenAI**: gpt-4, gpt-4-turbo, gpt-3.5-turbo
- **Anthropic**: claude-3-opus, claude-3-sonnet
- **Google**: gemini-pro, gemini-2.0-flash
- **Minimax**: MiniMax-M2.5

## 📁 项目结构

```
b2btrade-agent/
├── src/
│   ├── agents/         # 8位Agent定义
│   ├── tools/          # 工具模块（搜索等）
│   ├── workflows/      # 自动化工作流
│   ├── ai.js          # AI API对接
│   ├── config.js       # 配置管理
│   └── index.js       # 主入口
├── package.json
└── README.md
```

## 🛠️ 扩展工具（可选）

要启用浏览器搜索功能，需要安装：

```bash
npm install -g agent-browser
```

## 📝 License

MIT

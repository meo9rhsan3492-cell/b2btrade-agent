/**
 * B2Btrade-agent 工作流引擎 v2
 * 预设外贸业务流程，含输出持久化 + 进度动画
 */
import chalk from 'chalk';
import { mkdirSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// 确保输出目录
function ensureOutputDir() {
  const dir = join(homedir(), '.b2btrade-agent', 'output');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function log(filename, content) {
  ensureOutputDir();
  const ts = new Date().toISOString().slice(0, 10);
  const f = join(ensureOutputDir(), `${filename}-${ts}.md`);
  appendFileSync(f, content + '\n\n');
  return f;
}

// 进度条动画
function progressBar(done, total, label = '') {
  const pct = Math.round((done / total) * 100);
  const filled = Math.round((done / total) * 30);
  const bar = '█'.repeat(filled) + '░'.repeat(30 - filled);
  process.stdout.write(`\r  ${bar} ${pct}% ${label}`);
  if (done === total) process.stdout.write('\n');
}

// ===== 工作流1：客户挖掘 → 开发信 =====
export async function workflowFindAndEmail(targetCountry, product, aiChat) {
  console.log(chalk.cyan(`\n📋 工作流：客户挖掘 → 开发信`));
  console.log(chalk.gray(`   目标: ${targetCountry} | ${product}\n`));

  const steps = [
    { name: '挖掘目标客户', agent: 'intelligence', done: false },
    { name: '获取联系方式', agent: 'intelligence', done: false },
    { name: '生成开发信', agent: 'content', done: false }
  ];

  // Step 1: 挖掘客户
  steps[0].done = true;
  progressBar(1, 3, '🎯 挖掘目标客户...');
  const customers = await aiChat(
    `为 "${targetCountry}" 的 "${product}" 找出20家潜在采购商。

输出格式（严格遵循）：
## 采购商列表

| # | 公司名 | 官网 | 主要产品 | 规模 | 开发价值 |
|---|--------|------|---------|------|---------|
| 1 | ... | ... | ... | ... | ⭐⭐⭐ |

要求：
- 优先有明确采购历史的B2B公司
- 每家注明推测依据
- 按开发价值排序`, 'intelligence'
  );
  console.log(chalk.green(`  ✅ 找到目标客户`));

  // Step 2: 获取联系方式
  steps[1].done = true;
  progressBar(2, 3, '🔍 获取联系方式...');
  const contacts = await aiChat(
    `从上述 ${targetCountry} 的采购商列表中，选择前5家，给出：
1. 采购决策人姓名+职位+LinkedIn URL
2. 公司邮箱（格式如 john@company.com，推测域名）
3. 采购信号（近期新闻/展会/招聘等）

无LinkedIn信息时标注"待核实"。`, 'intelligence'
  );
  console.log(chalk.green(`  ✅ 联系方式已获取`));

  // Step 3: 生成开发信
  steps[2].done = true;
  progressBar(3, 3, '✍️ 生成开发信...');
  const emails = await aiChat(
    `为以上5家客户各生成1封个性化开发信，要求：
1. 每封信不超过150字
2. 提及对方公司名和近期动态（体现做过功课）
3. 风格：专业友好，不堆砌产品参数
4. 每封信结尾有明确CTA（预约通话/发资料/发报价单）

格式：
## 开发信 1 - [公司名]
**To:** [邮箱]
**主题:** [个性化标题，不含RE/FW]

[邮件正文，3-4段]`, 'content'
  );
  console.log(chalk.green(`  ✅ 开发信已生成`));

  // 持久化
  const outFile = log('cold-emails', `# 外贸开发邮件 - ${targetCountry} ${product}\n${new Date().toLocaleString('zh-CN')}\n\n## 客户信息\n${contacts}\n\n## 开发信\n${emails}`);

  console.log(chalk.green(`\n✅ 工作流完成！`));
  console.log(chalk.gray(`📁 输出文件: ${outFile}`));
  return { customers, contacts, emails, outFile };
}

// ===== 工作流2：询盘分析 → 报价 =====
export async function workflowRFQ(rfqText, aiChat) {
  console.log(chalk.cyan(`\n📋 工作流：询盘分析 → 报价单\n`));
  console.log(chalk.gray(`   询盘: ${rfqText.slice(0, 60)}...\n`));

  progressBar(1, 3, '🔍 分析询盘...');
  const analysis = await aiChat(
    `分析以下询盘，严格按以下格式输出：

## 询盘分析报告

### 1. 客户画像
- 类型判断（终端/贸易商/代理商）
- 真实性评估（高/中/低）和依据
- 采购紧急度（紧急/正常/试探）

### 2. 产品拆解
- 品名+规格
- 数量折算（如有必要）
- 交期评估（可行/紧张/不可行）

### 3. 价格策略
- 参考价格区间（FOB/CIF分别报价）
- 报价浮动空间
- 还价底线

### 4. 风险提示
- 质量风险
- 交期风险
- 付款风险

### 5. 行动建议
- 立刻要确认的3个问题
- 优先联系渠道

---
询盘内容：${rfqText}`, 'rfq'
  );
  progressBar(1, 3, '✅ 询盘分析完成');

  progressBar(2, 3, '💰 生成报价单...');
  const quote = await aiChat(
    `基于以下询盘分析，生成一份专业报价单（Proforma Invoice）：

${analysis}

报价单格式：
## Proforma Invoice

| 品名 | 规格 | 数量 | 单价(FOB) | 单价(CIF) | 总价 |
|------|------|------|---------|---------|------|
| ... | ... | ... | $... | $... | $... |

包含：
- 报价有效期（30天）
- 交货期
- 付款方式建议
- 包装方式
- 备注条款`, 'rfq'
  );
  progressBar(2, 3, '✅ 报价单生成');

  progressBar(3, 3, '📋 谈判策略...');
  const negotiation = await aiChat(
    `基于以上询盘分析和报价，给出谈判策略：
1. 客户可能的3个压价点及应对话术
2. 付款方式谈判方案（建议 vs 让步底线）
3. 交期货期谈判方案
4. 签订合同前必须确认的5个问题`, 'negotiation'
  );
  progressBar(3, 3, '✅ 策略完成');

  const outFile = log('rfq-analysis', `# 询盘分析报告 - ${new Date().toLocaleString('zh-CN')}\n\n## 询盘\n${rfqText}\n\n## 分析\n${analysis}\n\n## 报价\n${quote}\n\n## 谈判策略\n${negotiation}`);

  console.log(chalk.green(`\n✅ 工作流完成！`));
  console.log(chalk.gray(`📁 输出文件: ${outFile}`));
  return { analysis, quote, negotiation, outFile };
}

// ===== 工作流3：市场调研 =====
export async function workflowMarketResearch(country, product, aiChat) {
  console.log(chalk.cyan(`\n📋 工作流：市场调研报告\n`));
  console.log(chalk.gray(`   目标市场: ${country} | ${product}\n`));

  progressBar(1, 4, '📊 市场规模...');
  const market = await aiChat(
    `调研 ${country} 的 ${product} 市场，输出一份结构化市场报告：

## ${country} ${product} 市场报告

### 1. 市场概况
- 市场规模（金额+增长率）
- 近年趋势（上升/稳定/下降）
- 主要驱动因素

### 2. 竞争格局
- 主要玩家（TOP5，含市场份额）
- 中国竞争者（如有）
- 价格区间分布

### 3. 政策与准入
- 关税税率
- 认证要求（CE/API/等）
- 进口管制

### 4. 渠道结构
- 主要采购渠道
- 决策链（谁是买家）
- 典型采购周期

### 5. 进入建议
- 最佳切入点
- 常见坑和避坑指南
- 目标客户画像`, 'intelligence'
  );
  progressBar(1, 4, '✅ 市场规模完成');

  progressBar(2, 4, '🎯 目标客户...');
  const targets = await aiChat(
    `基于以上市场调研，在 ${country} 找出10家最适合的中国 ${product} 出口目标客户：

## 目标客户列表

| # | 公司 | 类型 | 官网 | 为什么选这家 | 联系策略 |
|---|------|------|------|-------------|---------|
| 1 | ... | ... | ... | ... | ... |

要求：
- 优先有明确采购中国设备历史的
- 标注公司规模和推测年采购量
- 给出具体联系策略`, 'intelligence'
  );
  progressBar(2, 4, '✅ 目标客户完成');

  progressBar(3, 4, '📝 开发策略...');
  const strategy = await aiChat(
    `为 ${country} 市场的 ${product} 出口制定进入策略：

1. **定价策略**：含税价/FOB/CIF建议区间
2. **渠道策略**：展会/B2B平台/直销/代理商，哪种最适合？
3. **内容营销**：目标市场的社媒平台偏好，内容风格建议
4. **风险预案**：收款风险（建议中信保覆盖比例）
5. **时间表**：从准备到首单的预计周期`, 'growth'
  );
  progressBar(3, 4, '✅ 开发策略完成');

  progressBar(4, 4, '✅ 报告生成');
  const outFile = log('market-research', `# 市场调研报告 - ${country} ${product}\n${new Date().toLocaleString('zh-CN')}\n\n${market}\n\n## 目标客户\n${targets}\n\n## 进入策略\n${strategy}`);

  console.log(chalk.green(`\n✅ 工作流完成！`));
  console.log(chalk.gray(`📁 输出文件: ${outFile}`));
  return { market, targets, strategy, outFile };
}

// ===== 工作流4：竞品监控 =====
export async function workflowCompetitorMonitor(competitor, product, aiChat) {
  console.log(chalk.cyan(`\n📋 工作流：竞品监控\n`));
  console.log(chalk.gray(`   竞品: ${competitor} | ${product}\n`));

  progressBar(1, 3, '🔍 竞品信息...');
  const intel = await aiChat(
    `监控竞品 "${competitor}" 的 ${product} 动态：

1. 最新产品发布或更新
2. 价格变动
3. 市场动作（展会/广告/招聘等）
4. 客户评价（来源：Google/Trustpilot/行业论坛）
5. 优劣势分析（vs 中国供应商）`, 'seo'
  );
  progressBar(1, 3, '✅ 竞品信息完成');

  progressBar(2, 3, '⚔️ 差异化策略...');
  const diff = await aiChat(
    `基于竞品 "${competitor}" 的分析，给出中国供应商的差异化策略：
1. 价格差异化（如何与竞品竞争）
2. 服务差异化（售前/售中/售后）
3. 技术差异化（如适用）
4. 定制化能力`, 'growth'
  );
  progressBar(2, 3, '✅ 策略完成');

  progressBar(3, 3, '📧 销售话术...');
  const pitch = await aiChat(
    `基于以上分析，生成3段销售话术（用于应对"你们比XXX贵/不如XXX"）：
1. 质量导向回应
2. 服务导向回应
3. 性价比综合回应
每段话术50字内，适合电话或当面沟通使用。`, 'content'
  );
  progressBar(3, 3, '✅ 话术完成');

  const outFile = log('competitor-monitor', `# 竞品监控 - ${competitor}\n${new Date().toLocaleString('zh-CN')}\n\n## 竞品情报\n${intel}\n\n## 差异化策略\n${diff}\n\n## 销售话术\n${pitch}`);

  console.log(chalk.green(`\n✅ 工作流完成！`));
  console.log(chalk.gray(`📁 输出文件: ${outFile}`));
  return { intel, diff, pitch, outFile };
}

// 可用工作流列表
export function listWorkflows() {
  return [
    {
      id: 'find-email',
      name: '客户挖掘 → 开发信',
      description: '从0找到客户并生成个性化开发信',
      params: ['目标国家', '产品'],
      agent: 'intelligence + content'
    },
    {
      id: 'rfq-quote',
      name: '询盘分析 → 报价',
      description: '分析询盘 + 生成专业报价单 + 谈判策略',
      params: ['询盘内容'],
      agent: 'rfq + negotiation'
    },
    {
      id: 'market-research',
      name: '市场调研报告',
      description: '目标市场全面调研报告 + 目标客户 + 进入策略',
      params: ['目标国家', '产品'],
      agent: 'intelligence + growth'
    },
    {
      id: 'competitor',
      name: '竞品监控',
      description: '竞品动态监控 + 差异化策略 + 销售话术',
      params: ['竞品名称', '产品'],
      agent: 'seo + growth + content'
    }
  ];
}

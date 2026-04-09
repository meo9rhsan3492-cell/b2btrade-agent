/**
 * 询盘智能分类 Agent
 */

import chalk from 'chalk';
import { llmCall } from './orchestrator.js';

const CLASSIFY_SCHEMA = {
  type: 'object',
  required: ['category', 'confidence', 'reasoning', 'suggested_action', 'priority'],
  properties: {
    category: {
      type: 'string',
      enum: ['high_value', 'real_customer', 'spam', 'competitor', 'unknown']
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
    suggested_action: { type: 'string' },
    priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low', 'skip'] },
    buyer_profile: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        decision_maker: { type: 'string' },
        budget_estimate: { type: 'string' },
        timeline: { type: 'string' }
      }
    },
    risk_signals: { type: 'array', items: { type: 'string' } },
    key_points: { type: 'array', items: { type: 'string' } },
    reply_guidance: { type: 'string' }
  }
};

function buildClassifyPrompt(inquiry) {
  const { name, company, email, message, language = 'zh' } = inquiry;
  return `你是一个15年经验的外贸销售总监，负责分析B2B询盘的质量和价值。

## 询盘信息
- 客户姓名：${name || '未知'}
- 公司名称：${company || '未知'}
- 邮箱：${email || '未知'}
- 消息内容：${message || '无'}
- 询盘语言：${language === 'zh' ? '中文' : '英文'}

## 分类标准
1. **high_value**：明确品名+数量+交期，知名公司
2. **real_customer**：有真实采购需求，非群发
3. **spam**：群发模板，免费样品索取
4. **competitor**：套取产品信息
5. **unknown**：信息不足

直接输出JSON对象。`;
}

function classifyByRules(inquiry) {
  const { name, company, email, message } = inquiry;
  const text = `${name || ''} ${company || ''} ${message || ''}`.toLowerCase();
  const spamKeywords = ['free sample', '免费样品', '免费目录', 'lowest price', '最低价'];
  const highScore = ['need', 'want to buy', 'quantity', 'pcs', 'units', 'container', '我们需要', '想采购'].filter(k => text.includes(k)).length +
    (email?.includes('@') ? 1 : 0) + (company?.length > 3 ? 1 : 0);

  if (spamKeywords.some(k => text.includes(k))) {
    return { category: 'spam', confidence: 0.6, reasoning: '垃圾关键词', suggested_action: '跳过', priority: 'skip' };
  }
  if (highScore >= 3) {
    return { category: 'real_customer', confidence: 0.65, reasoning: '规则匹配真实客户', suggested_action: '优先回复', priority: 'high' };
  }
  return { category: 'unknown', confidence: 0.4, reasoning: '无法确定', suggested_action: '人工审核', priority: 'medium' };
}

export async function classifyInquiry(inquiry) {
  try {
    const result = await llmCall(buildClassifyPrompt(inquiry), {
      agentId: 'default',
      schema: CLASSIFY_SCHEMA,
      retries: 2,
      timeout: 45000,
      temperature: 0.2,
    });
    return { ...result, _llm_used: true, _raw_inquiry: { name: inquiry.name, company: inquiry.company, email: inquiry.email, message: inquiry.message?.slice(0, 200) } };
  } catch (e) {
    console.log(chalk.yellow(`⚠️ LLM 不可用，降级到规则引擎: ${e.message}`));
    return { ...classifyByRules(inquiry), _llm_used: false, _raw_inquiry: { name: inquiry.name, company: inquiry.company, email: inquiry.email, message: inquiry.message?.slice(0, 200) } };
  }
}

const CATEGORY_LABELS = { high_value: '⭐ 高价值', real_customer: '✅ 真实客户', spam: '🚫 垃圾', competitor: '⚠️ 竞品套价', unknown: '❓ 待定' };
const PRIORITY_LABELS = { urgent: chalk.red('🔴 紧急'), high: chalk.green('🟢 高'), medium: chalk.yellow('🟡 中'), low: chalk.gray('⚪ 低'), skip: chalk.gray('⬜ 跳过') };

export function formatInquiryResult(result) {
  const lines = [];
  lines.push(chalk.bold('\n📋 询盘分类结果\n'));
  lines.push('─'.repeat(50));
  lines.push(`  客户     : ${result._raw_inquiry.name || '未知'}`);
  lines.push(`  公司     : ${result._raw_inquiry.company || '未知'}`);
  lines.push(`  邮箱     : ${result._raw_inquiry.email || '未知'}`);
  lines.push('─'.repeat(50));
  lines.push(`  ${chalk.bold('分类')}     : ${CATEGORY_LABELS[result.category] || result.category}`);
  lines.push(`  置信度   : ${Math.round((result.confidence || 0) * 100)}%`);
  lines.push(`  优先级   : ${PRIORITY_LABELS[result.priority] || result.priority}`);
  if (result.reasoning) lines.push(`  ${chalk.bold('理由')}     : ${result.reasoning}`);
  if (result.suggested_action) lines.push(`  ${chalk.bold('建议')}     : ${result.suggested_action}`);
  if (result.buyer_profile?.type) lines.push(`    类型     : ${result.buyer_profile.type}`);
  if (result.buyer_profile?.budget_estimate) lines.push(`    预算     : ${result.buyer_profile.budget_estimate}`);
  if (result.risk_signals?.length) {
    lines.push(chalk.red('  ⚠️ 风险信号:'));
    result.risk_signals.forEach(s => lines.push(`    - ${s}`));
  }
  if (result.key_points?.length) {
    lines.push(chalk.bold('  📌 关键信息:'));
    result.key_points.forEach(p => lines.push(`    • ${p}`));
  }
  if (result.reply_guidance) lines.push(chalk.cyan(`  💡 回复建议: ${result.reply_guidance}`));
  lines.push('─'.repeat(50));
  lines.push(result._llm_used ? chalk.gray(`  [LLM 智能分类]`) : chalk.gray(`  [规则引擎 fallback]`));
  return lines.join('\n');
}

export const inquiryIntelAgent = {
  id: 'inquiry-intel',
  name: '🔍 询盘情报员',
  role: '询盘智能分类与分析',
  description: '分析询盘质量，过滤垃圾，分流高价值客户',

  async run(args) {
    let inquiry;
    if (args.length >= 1) {
      const raw = args.join(' ');
      try {
        const parsed = JSON.parse(raw);
        if (parsed.name || parsed.company || parsed.email || parsed.message) inquiry = parsed;
        else throw new Error('no valid fields');
      } catch {
        const parts = raw.split(',').map(s => s.trim());
        inquiry = parts.length >= 4
          ? { name: parts[0], company: parts[1], email: parts[2], message: parts.slice(3).join(', ') }
          : parts.length >= 1 ? { message: parts[0] } : {};
        if (Object.keys(inquiry).length === 0) {
          console.log(chalk.yellow('⚠️ 参数格式：name, company, email, message'));
          return;
        }
      }
    } else {
      console.log(chalk.yellow('⚠️ 请提供询盘信息'));
      return;
    }
    const result = await classifyInquiry(inquiry);
    console.log(formatInquiryResult(result));
  }
};

export default inquiryIntelAgent;
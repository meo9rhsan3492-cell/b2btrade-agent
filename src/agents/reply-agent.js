/**
 * Reply Agent - 个性化邮件生成
 */

import chalk from 'chalk';
import { classifyInquiry } from './inquiry-intel-agent.js';
import { llmCall } from './orchestrator.js';

const REPLY_SCHEMA = {
  type: 'object',
  required: ['subject', 'body', 'tone', 'next_action'],
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
    tone: { type: 'string', enum: ['professional', 'friendly', 'formal', 'casual'] },
    next_action: { type: 'string' },
    key_points: { type: 'array', items: { type: 'string' } },
    cta: { type: 'string' }
  }
};

function buildReplyPrompt(inquiry, classification) {
  const { name, company, message } = inquiry;
  const { category, key_points } = classification;
  return `你是一个15年经验的外贸销售专家，负责撰写B2B询盘回复邮件。

客户：${name || '未知'}
公司：${company || '未知'}
需求：${message || '无'}
分类：${category}

根据分类生成个性化邮件回复，JSON输出：
{"subject":"邮件主题","body":"HTML正文","tone":"语气","next_action":"下一步","key_points":["卖点1","卖点2"],"cta":"行动号召"}`;
}

export async function generateReply(inquiry, opts = {}) {
  const classification = await classifyInquiry(inquiry);
  if (classification.category === 'spam') {
    return {
      subject: 'Thanks for your interest',
      body: '<p>Thank you for your inquiry. Best regards.</p>',
      tone: 'friendly',
      next_action: 'skip',
      key_points: [],
      cta: 'N/A',
      _classification: classification
    };
  }

  try {
    const result = await llmCall(buildReplyPrompt(inquiry, classification), {
      agentId: 'default',
      schema: REPLY_SCHEMA,
      retries: 2,
      timeout: 60000,
      temperature: 0.4,
    });
    return { ...result, _classification: classification };
  } catch (e) {
    console.log(chalk.yellow(`⚠️ LLM 不可用: ${e.message}`));
    return {
      subject: 'Re: Inquiry - Thank You',
      body: `<p>Dear ${inquiry.name || 'Sir/Madam'},</p><p>Thank you for your inquiry about our products.</p><p>We will get back to you shortly with details.</p><p>Best regards,<br/>Sales Team</p>`,
      tone: 'professional',
      next_action: 'await_more_info',
      key_points: [],
      cta: 'Reply with requirements',
      _classification: classification,
      _fallback: true
    };
  }
}

export function formatReplyResult(result) {
  const lines = [];
  lines.push(chalk.bold('\n📧 邮件生成结果\n'));
  lines.push('─'.repeat(50));
  lines.push(chalk.bold('  主题: ') + result.subject);
  lines.push(chalk.bold('  语气: ') + result.tone);
  lines.push(chalk.bold('  下一步: ') + result.next_action);
  if (result.key_points?.length) {
    lines.push('\n  卖点:');
    result.key_points.forEach(p => lines.push(`    • ${p}`));
  }
  if (result.cta) lines.push(chalk.cyan('  CTA: ') + result.cta);
  lines.push('─'.repeat(50));
  const textOnly = (result.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
  lines.push(chalk.gray('  正文预览: ' + textOnly + '...'));
  lines.push(result._fallback ? chalk.gray('  [模板生成]') : chalk.gray('  [LLM 生成]'));
  return lines.join('\n');
}

export const replyAgent = {
  id: 'reply',
  name: '📧 回复专家',
  role: '个性化邮件生成',
  description: '根据询盘分类结果生成个性化回复邮件',

  async run(args) {
    let inquiry;
    const raw = args.join(' ');
    const match = raw.match(/--inquiry\s+"([^"]+)"/) || raw.match(/--inquiry\s+(\S+)/);
    if (match) {
      const parts = match[1].split(',').map(s => s.trim());
      inquiry = { name: parts[0], company: parts[1], email: parts[2], message: parts.slice(3).join(', ') };
    } else {
      const parts = raw.split(',').map(s => s.trim());
      inquiry = parts.length >= 2 ? { name: parts[0], company: parts[1], message: parts.slice(2).join(', ') } : { message: raw };
    }
    if (!inquiry || !inquiry.message) {
      console.log(chalk.yellow('⚠️ 用法: node src/index.js reply --inquiry "John, ABC Corp, need excavators"'));
      return;
    }
    const result = await generateReply(inquiry);
    console.log(formatReplyResult(result));
  }
};

export default replyAgent;
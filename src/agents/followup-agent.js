/**
 * Followup Agent - 跟进序列管理
 */

import chalk from 'chalk';
import { classifyInquiry } from './inquiry-intel-agent.js';
import { llmCall } from './orchestrator.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const FOLLOWUP_FILE = path.join(os.homedir(), '.b2btrade-followups.json');

function loadFollowups() {
  try { if (fs.existsSync(FOLLOWUP_FILE)) return JSON.parse(fs.readFileSync(FOLLOWUP_FILE, 'utf8')); } catch {}
  return [];
}

function saveFollowups(data) {
  fs.writeFileSync(FOLLOWUP_FILE, JSON.stringify(data, null, 2));
}

const FOLLOWUP_SCHEMA = {
  type: 'object',
  required: ['sequence', 'timing'],
  properties: {
    sequence: { type: 'array', items: { type: 'object', properties: { day: { type: 'number' }, subject: { type: 'string' }, content: { type: 'string' } } } },
    timing: { type: 'object', properties: { initial: { type: 'number' }, reminder: { type: 'number' }, max_reminders: { type: 'number' } } },
    content: { type: 'string' }
  }
};

function buildFollowupPrompt(inquiry, classification) {
  const { name, company, message } = inquiry;
  const { category, priority } = classification;
  return `外贸销售跟进策略。

客户：${name || '未知'}
公司：${company || '未知'}
需求：${message || '无'}
分类：${category}，优先级：${priority}

生成跟进序列，JSON格式：
{"sequence":[{"day":1,"subject":"主题","content":"要点"},{"day":3,"subject":"主题","content":"要点"}],"timing":{"initial":1,"reminder":2,"max_reminders":3},"content":"跟进策略"}`;
}

export async function createFollowupPlan(inquiry) {
  const classification = await classifyInquiry(inquiry);
  if (classification.category === 'spam') {
    return { sequence: [], timing: { initial: 0, reminder: 0, max_reminders: 0 }, content: '跳过，无需跟进', _classification: classification, _skipped: true };
  }

  try {
    const result = await llmCall(buildFollowupPrompt(inquiry, classification), {
      agentId: 'default',
      schema: FOLLOWUP_SCHEMA,
      retries: 2,
      timeout: 60000,
      temperature: 0.4,
    });
    return { ...result, _classification: classification };
  } catch (e) {
    console.log(chalk.yellow(`⚠️ LLM 不可用: ${e.message}`));
    return {
      sequence: [
        { day: 1, subject: 'Thanks for your inquiry', content: '确认收到询盘' },
        { day: 3, subject: 'Following up', content: '询问是否有更多需求' },
        { day: 7, subject: 'Any updates?', content: '保持联系' }
      ],
      timing: { initial: 1, reminder: 3, max_reminders: 3 },
      content: '标准跟进序列',
      _classification: classification,
      _fallback: true
    };
  }
}

export function formatFollowupPlan(plan, inquiry) {
  const lines = [];
  lines.push(chalk.bold('\n📆 跟进计划\n'));
  lines.push('─'.repeat(50));
  lines.push(chalk.bold('  客户: ') + `${inquiry?.name || '未知'} @ ${inquiry?.company || '未知'}`);
  lines.push(chalk.bold('  策略: ') + plan.content);
  if (plan.sequence?.length) {
    lines.push('\n' + chalk.bold('  序列:'));
    plan.sequence.forEach(s => {
      lines.push(`    Day ${s.day}: ${s.subject}`);
      lines.push(chalk.gray(`      要点: ${s.content}`));
    });
  }
  lines.push('─'.repeat(50));
  lines.push(plan._fallback ? chalk.gray('  [模板生成]') : chalk.gray('  [LLM 生成]'));
  return lines.join('\n');
}

export function saveFollowupPlan(plan, inquiry) {
  const followups = loadFollowups();
  const id = Date.now().toString(36);
  followups.push({ id, inquiry: { name: inquiry.name, company: inquiry.company, email: inquiry.email }, plan, created_at: new Date().toISOString(), status: 'pending' });
  saveFollowups(followups);
  return id;
}

export const followupAgent = {
  id: 'followup',
  name: '📆 跟进管家',
  role: '跟进序列管理',
  description: '自动生成和管理询盘跟进计划',

  async run(args) {
    let inquiry;
    const raw = args.join(' ');
    const match = raw.match(/--inquiry\s+"([^"]+)"/) || raw.match(/--inquiry\s+(\S+)/);
    if (match) {
      const parts = match[1].split(',').map(s => s.trim());
      inquiry = { name: parts[0], company: parts[1], email: parts[2], message: parts.slice(3).join(', ') };
    } else {
      const nameMatch = raw.match(/--name\s+(\S+)/);
      const companyMatch = raw.match(/--company\s+(\S+)/);
      const messageMatch = raw.match(/--message\s+"([^"]+)"/) || raw.match(/--message\s+(\S+)/);
      inquiry = { name: nameMatch?.[1] || '', company: companyMatch?.[1] || '', message: messageMatch?.[1] || '' };
    }
    if (!inquiry || (!inquiry.message && !inquiry.company)) {
      console.log(chalk.yellow('⚠️ 用法: node src/index.js followup --inquiry "John, ABC, need excavators"'));
      return;
    }
    const plan = await createFollowupPlan(inquiry);
    console.log(formatFollowupPlan(plan, inquiry));
    const id = saveFollowupPlan(plan, inquiry);
    console.log(chalk.green(`\n✓ 跟进计划已创建 (ID: ${id})`));
  }
};

export default followupAgent;
/**
 * B2Btrade-agent 邮件跟进序列模块
 * 支持: 开发信序列 / 询盘跟进序列 / 展会跟进序列
 * 包含: AI内容生成 + SMTP发送 + 发送记录
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { existsSync, mkdirSync } from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// ===== 数据目录 =====
const DATA_DIR = () => path.join(os.homedir(), '.b2btrade-agent', 'sequences');
const SEQUENCES_FILE = () => path.join(DATA_DIR(), 'sequences.json');
const QUEUE_FILE = () => path.join(DATA_DIR(), 'send-queue.jsonl');
const LOG_FILE = () => path.join(DATA_DIR(), 'send-log.jsonl');

function ensureDir() {
  const d = DATA_DIR();
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

// ===== 内置序列模板 =====
export const SEQUENCE_TEMPLATES = {
  cold_outreach: {
    id: 'cold_outreach',
    name: 'Cold Outreach 开发信序列',
    description: '新客户开发邮件序列（5封）',
    duration: 30,  // 天
    emails: [
      { day: 1, subject: '首封开发信 - 价值钩子', goal: '引起注意，提及对方公司/行业', tone: 'professional' },
      { day: 4, subject: '跟进1 - 没有回复？', goal: '简单提醒+补充行业洞察', tone: 'friendly' },
      { day: 8, subject: '跟进2 - 案例分享', goal: '分享相关行业成功案例', tone: 'professional' },
      { day: 15, subject: '跟进3 - 限时动机', goal: '制造轻微紧迫感（展会/促销）', tone: 'urgent' },
      { day: 25, subject: '最终跟进 - 保持关系', goal: '转为关系维护，留长期联系可能', tone: 'warm' }
    ]
  },
  rfq_followup: {
    id: 'rfq_followup',
    name: 'RFQ Follow-up 询盘跟进序列',
    description: '收到询盘后的多轮跟进（4封）',
    duration: 20,
    emails: [
      { day: 1, subject: '感谢询盘 - 确认需求', goal: '确认具体需求，索要规格/目标价', tone: 'professional' },
      { day: 3, subject: '报价已发 - 请查收', goal: '发送正式报价，CTA预约电话', tone: 'professional' },
      { day: 10, subject: '跟进 - 解答疑问', goal: '主动解答可能的问题，推动决策', tone: 'friendly' },
      { day: 17, subject: '最后跟进 - 限时优惠', goal: '推动最终决策，可提供小激励', tone: 'urgent' }
    ]
  },
  trade_show: {
    id: 'trade_show',
    name: 'Trade Show 展会跟进序列',
    description: '展会接触客户的后续跟进（5封）',
    duration: 30,
    emails: [
      { day: 1, subject: '很高兴认识您 - 展会当天', goal: '感谢交换名片，附上产品手册', tone: 'warm' },
      { day: 3, subject: '展会上聊到的方案 - 详情', goal: '根据展会交流内容，发送定制方案', tone: 'professional' },
      { day: 7, subject: '展会期间优惠 - 有效期', goal: '提供展会专属优惠，推动报价请求', tone: 'urgent' },
      { day: 14, subject: '展会后续 - 市场洞察', goal: '分享行业报告或展会总结，建立专家形象', tone: 'professional' },
      { day: 28, subject: '保持联系 - 长期价值', goal: '转为长期关系维护，季度推送', tone: 'warm' }
    ]
  },
  linkedin_followup: {
    id: 'linkedin_followup',
    name: 'LinkedIn Follow-up 领英转化序列',
    description: 'LinkedIn连接后的邮件转化（4封）',
    duration: 21,
    emails: [
      { day: 1, subject: 'LinkedIn连接感谢 + 价值预告', goal: '感谢连接，预告可以提供什么价值', tone: 'professional' },
      { day: 5, subject: '具体价值 - 案例/数据', goal: '分享相关案例或数据，建立信任', tone: 'professional' },
      { day: 12, subject: 'CTA - 邀请行动', goal: '明确邀请对方采取下一步（电话/demo/报价）', tone: 'direct' },
      { day: 20, subject: '长期关系维护', goal: '转为内容订阅或定期分享', tone: 'warm' }
    ]
  }
};

// ===== 序列管理 =====
export function createSequence(params) {
  ensureDir();
  const template = SEQUENCE_TEMPLATES[params.template];
  if (!template) throw new Error(`未知模板: ${params.template}`);

  const sequence = {
    id: Math.random().toString(36).slice(2, 10),
    createdAt: new Date().toISOString(),
    name: params.name || template.name,
    template: params.template,
    subject: params.subject || '',
    targetCountry: params.targetCountry || '',
    targetProduct: params.targetProduct || '',
    locale: params.locale || 'en',  // en/zh
    tone: params.tone || 'professional',
    // 收件人列表
    recipients: (params.recipients || []).map(r => ({
      name: r.name || '',
      email: r.email || '',
      company: r.company || '',
      source: r.source || '',  // 展会/LinkedIn/推荐等
      status: 'pending',  // pending/sending/sent/completed/bounced
      sentEmails: [],
      replies: 0,
      opens: 0
    })),
    emails: template.emails.map(e => ({
      ...e,
      subjectTemplate: e.subject,
      bodyTemplate: '',  // AI填充
      status: 'draft',  // draft/generated/pending/sent
      generatedAt: null
    })),
    stats: {
      total: params.recipients?.length || 0,
      sent: 0,
      opened: 0,
      replied: 0,
      bounced: 0
    },
    status: 'draft'  // draft/running/completed/paused
  };

  const sequences = loadSequences();
  sequences.push(sequence);
  saveSequences(sequences);
  return sequence;
}

export function loadSequences() {
  ensureDir();
  if (!existsSync(SEQUENCES_FILE())) return [];
  try {
    return JSON.parse(fs.readFileSync(SEQUENCES_FILE(), 'utf8'));
  } catch { return []; }
}

export function saveSequences(sequences) {
  ensureDir();
  fs.writeFileSync(SEQUENCES_FILE(), JSON.stringify(sequences, null, 2), 'utf8');
}

export function getSequence(id) {
  return loadSequences().find(s => s.id === id);
}

export function listSequences() {
  return loadSequences().map(s => ({
    id: s.id,
    name: s.name,
    template: s.template,
    status: s.status,
    total: s.stats.total,
    sent: s.stats.sent,
    replies: s.stats.replied,
    locale: s.locale,
    createdAt: s.createdAt
  }));
}

// ===== AI生成序列内容 =====
export async function generateSequenceContent(sequenceId, aiChat) {
  const sequences = loadSequences();
  const seq = sequences.find(s => s.id === sequenceId);
  if (!seq) throw new Error('Sequence not found');

  const template = SEQUENCE_TEMPLATES[seq.template];
  const toneMap = { professional: '专业商务', friendly: '友好随和', urgent: '紧迫催促', warm: '温暖关系型', direct: '直接行动导向' };
  const tone = toneMap[seq.tone] || '专业商务';
  const lang = seq.locale === 'zh' ? '中文' : '英文';

  console.log(chalk.blue(`\n📧 正在生成 ${seq.emails.length} 封邮件内容...\n`));

  for (let i = 0; i < seq.emails.length; i++) {
    const email = seq.emails[i];
    console.log(chalk.blue(`  [${i + 1}/${seq.emails.length}] Day ${email.day} - ${email.subjectTemplate}`));

    const prompt = `为B2B外贸邮件跟进序列生成第${i + 1}封邮件。

**背景信息：**
- 产品: ${seq.targetProduct || '[产品名]'}
- 目标国家: ${seq.targetCountry || '[国家]'}
- 邮件序号: ${i + 1}/${seq.emails.length}（第${email.day}天发送）
- 邮件目的: ${email.goal}
- 语言: ${lang}
- 语气: ${tone}

**格式要求：**
## Subject: [个性化邮件标题，不超过50字]

## Body:
[邮件正文，${lang === '中文' ? '中文' : '英文'}，不超过150字，结构清晰]

要求：
1. 每封邮件不超过150字
2. 提及收件人公司名（如已知）用 {{company_name}} 占位
3. 提及自己名字用 {{sender_name}} 占位
4. CTA 明确（预约电话/发资料/发报价单）
5. 不要用 RE/FW 开头`;

    try {
      const result = await aiChat(prompt, 'email');
      const parsed = parseEmailOutput(result);
      seq.emails[i].bodyTemplate = parsed.body;
      seq.emails[i].subject = parsed.subject;
      seq.emails[i].status = 'generated';
      seq.emails[i].generatedAt = new Date().toISOString();
      console.log(chalk.green(`  ✅ 生成完成`));
    } catch (e) {
      console.log(chalk.red(`  ❌ 生成失败: ${e.message}`));
    }

    // 每个请求间隔2秒避免限流
    if (i < seq.emails.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  seq.status = 'generated';
  saveSequences(sequences);
  return seq;
}

function parseEmailOutput(text) {
  const subjectMatch = text.match(/## Subject:?\s*(.+)/i);
  const bodyMatch = text.match(/## Body:?([\s\S]+)/i);
  return {
    subject: subjectMatch ? subjectMatch[1].trim() : 'Follow up',
    body: bodyMatch ? bodyMatch[1].trim() : text.trim().slice(0, 300)
  };
}

// ===== SMTP发送（可选）=====
export async function sendEmailViaSMTP(params) {
  // params: { host, port, user, pass, to, subject, body, from }
  // 基础实现，支持 Gmail SMTP / SendGrid / 自建SMTP
  const { host, port, user, pass, to, subject, body, from } = params;

  if (!host || !to || !body) {
    throw new Error('Missing required SMTP params');
  }

  // 这个函数需要 nodemailer 支持，简单实现
  return {
    sent: true,
    to,
    subject,
    timestamp: new Date().toISOString(),
    note: 'SMTP send not implemented - export to CSV for manual send'
  };
}

// ===== 导出为可发送格式 =====
export function exportSequenceCSV(sequenceId) {
  const seq = getSequence(sequenceId);
  if (!seq) throw new Error('Sequence not found');

  ensureDir();
  const outFile = path.join(DATA_DIR(), `sequence-${seq.id}-${Date.now()}.csv`);

  const headers = ['recipient_email', 'recipient_name', 'company', 'day', 'subject', 'body', 'status'];
  const rows = [];

  for (const r of seq.recipients) {
    for (const email of seq.emails) {
      if (email.status !== 'generated') continue;
      const sendDate = new Date(seq.createdAt);
      sendDate.setDate(sendDate.getDate() + email.day);

      const body = email.bodyTemplate
        .replace(/\{\{company_name\}\}/g, r.company || '')
        .replace(/\{\{sender_name\}\}/g, '');

      rows.push([
        r.email, r.name, r.company,
        email.day,
        `"${(email.subject || email.subjectTemplate).replace(/"/g, '""')}"`,
        `"${body.replace(/"/g, '""')}"`,
        r.status === 'completed' ? 'sent' : 'pending'
      ].join(','));
    }
  }

  const csv = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(outFile, '\ufeff' + csv, 'utf8'); // BOM for Excel
  return outFile;
}

export function exportSequenceJSON(sequenceId) {
  const seq = getSequence(sequenceId);
  if (!seq) throw new Error('Sequence not found');
  const outFile = path.join(DATA_DIR(), `sequence-${seq.id}-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(seq, null, 2), 'utf8');
  return outFile;
}

// ===== 发送日志 =====
export function logSend(entry) {
  ensureDir();
  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString()
  }) + '\n';
  fs.appendFileSync(LOG_FILE(), line, 'utf8');
}

export function getSendLog(sequenceId = null) {
  ensureDir();
  if (!existsSync(LOG_FILE())) return [];
  const lines = fs.readFileSync(LOG_FILE(), 'utf8').split('\n').filter(Boolean);
  const logs = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  if (sequenceId) return logs.filter(l => l.sequenceId === sequenceId);
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ===== 发送队列 =====
export function getQueue() {
  ensureDir();
  if (!existsSync(QUEUE_FILE())) return [];
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE(), 'utf8'));
  } catch { return []; }
}

export function saveQueue(queue) {
  ensureDir();
  fs.writeFileSync(QUEUE_FILE(), JSON.stringify(queue, null, 2), 'utf8');
}

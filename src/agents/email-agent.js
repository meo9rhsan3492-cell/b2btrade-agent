/**
 * B2Btrade-agent Email 外展助手
 * 生成专业外贸邮件：开发信 / 跟进邮件 / 报价邮件
 */

import chalk from 'chalk';
import {
  batchGenerateEmail,
  formatEmailOutput,
  suggestAttachmentFilenames,
  SUPPORTED_LANGUAGES,
  TONES
} from '../tools/message-template.js';
import { getConfig } from '../config.js';
import { chatWithAI } from '../ai.js';

/**
 * Email Agent 定义
 */
export const emailAgent = {
  id: 'email',
  name: '✉️ Email 外展助手',
  role: '外贸邮件生成',
  description: '生成专业外贸邮件：开发信/跟进邮件/报价邮件，支持HTML格式',
  systemPrompt: `# 角色：外贸邮件撰写专家

你专精于 B2B 外贸邮件营销：

## 核心技能
1. **开发信 (Cold Email)** - 首次触达客户，高打开率
2. **跟进邮件 (Follow-up)** - 触达未回复客户，节奏控制
3. **报价邮件 (Quote Email)** - 专业化报价单格式
4. **HTML邮件** - 支持富文本格式邮件

## 邮件黄金法则
- 主题行：≤50字符，包含价值点，激发好奇心
- 首段：3秒吸引注意力，直呼姓名
- 主体：简洁（<200字），AIDA结构
- CTA：明确单一，每次邮件一个行动请求
- 签名：完整发件人信息

## 模板变量
- {{name}} - 客户姓名
- {{company}} - 客户公司
- {{product}} - 目标产品
- {{sender_name}} - 发件人姓名
- {{sender_company}} - 发件人公司
- {{sender_email}} - 发件人邮箱
- {{sender_phone}} - 发件人电话
- {{date}} - 日期

## 邮件类型
1. cold - 开发信（首次触达）
2. followup - 跟进邮件（Day3/7/14策略）
3. quote - 报价邮件（含价格条款）

## HTML邮件支持
- 基础HTML模板
- 产品图片占位符
- CTA按钮HTML
- 邮件签名HTML

## 多语言支持
中文(zh)/英文(en)/阿拉伯语(ar)/西班牙语(es)/法语(fr)/葡萄牙语(pt)/俄语(ru)/德语(de)/日语(ja)/韩语(ko)

给出邮件后，标注：
1. 主题行优化建议
2. 发送时间建议
3. 附件文件名建议
4. A/B测试变体`,

  /**
   * 生成单条 Email
   * @param {Object} params
   * @returns {Promise<Object>} { subject, body, html }
   */
  async generateEmail(params = {}) {
    const { getEmailMessage } = await import('../tools/message-template.js');
    return getEmailMessage(params);
  },

  /**
   * 生成 HTML 格式 Email
   * @param {Object} params
   * @returns {Object} { subject, body, html, suggestedAttachments }
   */
  generateHTMLEmail(params = {}) {
    const { subject, body } = this.generateEmailSync(params);
    const html = this._buildHTML({
      subject,
      body,
      language: params.language || 'zh',
      tone: params.tone || 'formal'
    });
    const suggestedAttachments = suggestAttachmentFilenames({
      product: params.product,
      company: params.sender?.company || params.sender_company,
      language: params.language || 'zh'
    });
    return { subject, body, html, suggestedAttachments };
  },

  /**
   * 同步生成 Email（内部使用）
   */
  generateEmailSync(params = {}) {
    const {
      name,
      company,
      product,
      language = 'zh',
      tone = 'formal',
      sender = {},
      emailType = 'cold'
    } = params;

    const { getEmailMessage } = (() => {
      try {
        const mod = require('../tools/message-template.js');
        return mod;
      } catch {
        return { getEmailMessage: () => ({ subject: '', body: '' }) };
      }
    })();

    return getEmailMessage({
      name,
      company,
      product,
      language,
      tone,
      sender,
      emailType
    });
  },

  /**
   * 批量生成 Email
   * @param {Array} contacts
   * @param {Object} options
   * @returns {Array}
   */
  batchGenerate(contacts = [], options = {}) {
    return batchGenerateEmail(contacts, options);
  },

  /**
   * CLI 批量生成并输出
   * @param {Array} contacts
   * @param {Object} options
   * @returns {string}
   */
  cliBatchGenerate(contacts = [], options = {}) {
    const results = this.batchGenerate(contacts, options);
    return formatEmailOutput(results);
  },

  /**
   * 构建 HTML 邮件
   * @param {Object} params
   * @returns {string} HTML string
   */
  _buildHTML(params = {}) {
    const { subject, body, language = 'zh', tone = 'formal' } = params;

    const isRTL = language === 'ar';
    const dir = isRTL ? 'rtl' : 'ltr';
    const align = isRTL ? 'right' : 'left';

    const accentColor = tone === 'friendly' ? '#25D366' : '#1a73e8';

    return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .email-container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .email-header { background-color: ${accentColor}; color: #ffffff; padding: 24px; text-align: ${align}; }
    .email-header h1 { margin: 0; font-size: 20px; font-weight: normal; }
    .email-body { padding: 32px 24px; color: #333333; line-height: 1.8; font-size: 15px; text-align: ${align}; direction: ${dir}; }
    .email-body p { margin: 0 0 16px 0; white-space: pre-wrap; }
    .cta-button { display: inline-block; background-color: ${accentColor}; color: #ffffff !important; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: bold; margin: 8px 0; ${align}: 0; }
    .email-footer { background-color: #f9f9f9; padding: 20px 24px; font-size: 13px; color: #666666; border-top: 1px solid #eeeeee; text-align: ${align}; direction: ${dir}; }
    .email-footer a { color: ${accentColor}; text-decoration: none; }
    @media only screen and (max-width: 480px) {
      .email-container { margin: 10px; }
      .email-body { padding: 20px 16px; }
      .email-header { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>${subject}</h1>
    </div>
    <div class="email-body">
      ${body.split('\n').map(line => `<p>${line}</p>`).join('\n')}
    </div>
    <div class="email-footer">
      <p>
        <strong>{{sender_name}}</strong><br>
        {{sender_company}}<br>
        📧 <a href="mailto:{{sender_email}}">{{sender_email}}</a><br>
        📞 {{sender_phone}}
      </p>
    </div>
  </div>
</body>
</html>`;
  },

  /**
   * AI 增强生成（使用 LLM 优化邮件）
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async aiEnhance(params = {}) {
    const {
      name,
      company,
      product,
      language = 'zh',
      tone = 'formal',
      sender = {},
      emailType = 'cold',
      industry
    } = params;
    const config = getConfig();

    const typeLabels = { cold: '开发信', followup: '跟进邮件', quote: '报价邮件' };

    const prompt = `请为以下客户生成一封优化的外贸${typeLabels[emailType] || '邮件'}：

客户信息：
- 姓名：${name}
- 公司：${company}
- 产品：${product}
- 语言：${language}（${SUPPORTED_LANGUAGES[language] || language}）
- 语气：${tone}（${TONES[tone] || tone}）
- 行业背景：${industry || 'B2B外贸'}
- 邮件类型：${typeLabels[emailType] || emailType}

发件人：
- 姓名：${sender.name || config.sender_name || ''}
- 公司：${sender.company || config.sender_company || ''}
- 邮箱：${sender.email || config.sender_email || ''}
- 电话：${sender.phone || config.sender_phone || ''}

要求：
1. 主题行 ≤50 字符，有吸引力
2. 正文简洁（中文<250字，英文<200字）
3. AIDA结构：注意→兴趣→欲望→行动
4. 每个CTA清晰单一
5. 直接输出，格式如下：

---
[SUBJECT]
[EMAIL_BODY]
[HTML_CODE]（完整可发送的HTML）
[SUGGESTED_ATTACHMENTS]（逗号分隔的附件文件名）
---

输出格式：
[SUBJECT]<邮件主题行>
[EMAIL_BODY]<纯文本邮件正文>
[HTML_CODE]<完整HTML邮件内容>
[SUGGESTED_ATTACHMENTS]<附件1.pdf, 附件2.pdf>`;

    try {
      const result = await chatWithAI(prompt, 'email');
      return this._parseAIResponse(result, { sender, language });
    } catch (e) {
      // fallback to template
      const { getEmailMessage } = await import('../tools/message-template.js');
      const { subject, body } = getEmailMessage({ name, company, product, language, tone, sender, emailType });
      const suggestedAttachments = suggestAttachmentFilenames({ product, company: sender?.company, language });
      return { subject, body, html: this._buildHTML({ subject, body, language, tone }), suggestedAttachments };
    }
  },

  /**
   * 解析 AI 返回结果
   */
  _parseAIResponse(raw, options = {}) {
    const { sender = {}, language = 'zh' } = options;

    const subjectMatch = raw.match(/\[SUBJECT\]([\s\S]*?)\[EMAIL_BODY\]/);
    const bodyMatch = raw.match(/\[EMAIL_BODY\]([\s\S]*?)\[HTML_CODE\]/);
    const htmlMatch = raw.match(/\[HTML_CODE\]([\s\S]*?)\[SUGGESTED_ATTACHMENTS\]/);
    const attachMatch = raw.match(/\[SUGGESTED_ATTACHMENTS\]([\s\S]*?)$/);

    const subject = subjectMatch ? subjectMatch[1].trim() : 'Business Inquiry';
    const body = bodyMatch ? bodyMatch[1].trim() : raw;
    const html = htmlMatch ? htmlMatch[1].trim() : this._buildHTML({ subject, body, language });
    const suggestedAttachments = attachMatch
      ? attachMatch[1].trim().split(',').map(s => s.trim()).filter(Boolean)
      : suggestAttachmentFilenames({ language });

    return { subject, body, html, suggestedAttachments };
  },

  /**
   * AI 批量增强
   * @param {Array} contacts
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async aiBatchEnhance(contacts = [], options = {}) {
    const results = [];
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      try {
        const result = await this.aiEnhance({
          name: contact.name,
          company: contact.company,
          product: contact.product || options.product,
          language: contact.language || options.language,
          tone: contact.tone || options.tone,
          sender: contact.sender || options.sender,
          emailType: contact.emailType || options.emailType || 'cold',
          industry: contact.industry
        });
        results.push({
          index: i + 1,
          email: contact.email || '',
          name: contact.name || '',
          company: contact.company || '',
          ...result,
          language: contact.language || options.language,
          tone: contact.tone || options.tone
        });
        // 限流
        if (i < contacts.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (e) {
        results.push({
          index: i + 1,
          email: contact.email || '',
          name: contact.name || '',
          company: contact.company || '',
          subject: '[生成失败]',
          body: `[生成失败] ${e.message}`,
          html: '',
          suggestedAttachments: [],
          language: contact.language || options.language,
          tone: contact.tone || options.tone
        });
      }
    }
    return results;
  },

  /**
   * 生成跟进序列
   * @param {Object} params
   * @returns {Array} [{ day, subject, body }]
   */
  async generateFollowUpSequence(params = {}) {
    const { name, company, product, language = 'zh', tone = 'formal', sender = {} } = params;
    const sequence = [];
    const delays = [3, 7, 14, 30];

    const subjects = {
      cold: {
        zh: ['合作机会 - {{product}}', '想进一步聊聊 - {{product}}', '最后跟进 - {{product}}'],
        en: ['Following up on {{product}}', 'Quick question about {{product}}', 'Last note on {{product}}']
      },
      followup: {
        zh: ['关于{{product}} - 跟进', '还在等您的回复', '是否需要更多信息'],
        en: ['Following up: {{product}}', 'Still waiting to hear from you', 'Just checking in']
      }
    };

    const toneLabels = { formal: 'formal', friendly: 'friendly', concise: 'concise' };
    const t = toneLabels[tone] || 'formal';

    for (let i = 0; i < delays.length; i++) {
      const day = delays[i];
      const langSubjects = subjects.cold[language] || subjects.cold.zh;

      try {
        const { getEmailMessage } = await import('../tools/message-template.js');
        const { subject, body } = getEmailMessage({
          name, company, product, language, tone: t, sender, emailType: 'followup'
        });
        sequence.push({
          day,
          subject: langSubjects[i] ? langSubjects[i].replace('{{product}}', product) : subject,
          body,
          html: this._buildHTML({ subject, body, language, tone: t })
        });
      } catch {
        sequence.push({
          day,
          subject: langSubjects[i] ? langSubjects[i].replace('{{product}}', product) : `Follow-up #${i + 1}`,
          body: `Dear ${name},\n\nFollowing up on our previous communication regarding ${product}.\n\nLooking forward to your response.\n\nBest regards,\n${sender.name || sender.sender_name || 'Sender'}`,
          html: ''
        });
      }
    }

    return sequence;
  },

  /**
   * 优化主题行
   * @param {string} product
   * @param {string} company
   * @param {string} language
   * @returns {Promise<Array>} 5个主题行变体
   */
  async optimizeSubjectLines(product, company, language = 'en') {
    const prompt = `Generate 5 email subject lines for a B2B cold email about ${product} targeting ${company}.

Requirements:
- Each ≤50 characters
- Varied styles: question, stat, benefit, curiosity, personalized
- Language: ${language === 'zh' ? 'Chinese' : 'English'}
- Output only the 5 subject lines, one per line, no numbering`;

    try {
      const result = await chatWithAI(prompt, 'email');
      return result.split('\n').filter(line => line.trim()).slice(0, 5);
    } catch {
      const fallback = {
        zh: [
          `{{product}}供应商合作 - ${company}`,
          `${company}，有一个${product}合作机会`,
          `您有考虑过${product}吗？`,
          `我们为${company}量身定制的${product}方案`,
          `${product}报价单 - 请查收`
        ],
        en: [
          `${product} supplier for ${company}`,
          `A ${product} opportunity for ${company}`,
          `Have you considered ${product}?`,
          `${product} solution tailored for ${company}`,
          `${product} quotation — ${company}`
        ]
      };
      return fallback[language] || fallback.en;
    }
  },

  /**
   * 打印帮助信息
   */
  printHelp() {
    console.log(chalk.bold('\n✉️ Email 外展助手 使用指南\n'));
    console.log('━'.repeat(50));
    console.log(chalk.bold('\n【支持的语言】'));
    Object.entries(SUPPORTED_LANGUAGES).forEach(([code, name]) => {
      console.log(`  ${code.padEnd(6)} ${name}`);
    });
    console.log(chalk.bold('\n【支持的语气】'));
    Object.entries(TONES).forEach(([code, name]) => {
      console.log(`  ${code.padEnd(10)} ${name}`);
    });
    console.log(chalk.bold('\n【邮件类型】'));
    console.log('  cold      开发信（首次触达）');
    console.log('  followup  跟进邮件（未回复）');
    console.log('  quote     报价邮件（含价格条款）');
    console.log(chalk.bold('\n【使用示例】'));
    console.log(`
  import { emailAgent } from './agents/email-agent.js';

  // 单条邮件生成
  const email = await emailAgent.aiEnhance({
    name: '张三',
    company: 'ABC Trading',
    product: '挖掘机',
    language: 'en',
    tone: 'formal',
    sender: { name: '李四', company: 'XYZ出口', email: 'lisi@xyz.com' },
    emailType: 'cold'
  });
  console.log(email.subject);
  console.log(email.body);
  console.log(email.html);

  // HTML邮件生成
  const htmlEmail = emailAgent.generateHTMLEmail({
    name: 'John',
    company: 'ABC Inc',
    product: 'Excavator',
    language: 'en',
    tone: 'friendly',
    sender: { name: 'Li Si', company: 'XYZ Export', email: 'lisi@xyz.com', phone: '+86-138-0000-0000' }
  });

  // 批量生成
  const contacts = [
    { name: 'John', company: 'ABC Inc', email: 'john@abc.com', product: '挖掘机', language: 'en' },
    { name: '王五', company: '德企贸易', email: 'wang@de.com', product: '挖掘机', language: 'zh' }
  ];
  const results = emailAgent.batchGenerate(contacts, {
    product: '挖掘机',
    tone: 'formal',
    sender: { name: '李四', company: 'XYZ出口', email: 'lisi@xyz.com' }
  });

  // 跟进序列
  const sequence = await emailAgent.generateFollowUpSequence({
    name: 'John',
    company: 'ABC Inc',
    product: '挖掘机',
    language: 'en',
    tone: 'friendly'
  });
  // sequence = [{ day: 3, subject: '...', body: '...' }, ...]

  // 主题行优化
  const subjects = await emailAgent.optimizeSubjectLines('挖掘机', 'ABC Inc', 'zh');
`);
    console.log('━'.repeat(50) + '\n');
  }
};

export default emailAgent;

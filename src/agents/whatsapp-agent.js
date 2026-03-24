/**
 * B2Btrade-agent WhatsApp 外展助手
 * 基于联系人列表生成个性化 WhatsApp 消息
 */

import chalk from 'chalk';
import { batchGenerateWhatsApp, formatWhatsAppOutput, SUPPORTED_LANGUAGES, TONES } from '../tools/message-template.js';
import { getConfig } from '../config.js';
import { chatWithAI } from '../ai.js';

/**
 * WhatsApp Agent 定义
 */
export const whatsappAgent = {
  id: 'whatsapp',
  name: '📱 WhatsApp外展助手',
  role: 'WhatsApp个性化消息生成',
  description: '基于联系人列表批量生成定制化WhatsApp消息，支持多语言',
  systemPrompt: `# 角色：WhatsApp 外展消息专家

你专精于 B2B 外贸 WhatsApp 营销：

## 核心技能
1. **个性化消息生成** - 基于客户姓名/公司/产品/语言定制消息
2. **多语言支持** - 中文/英文/阿拉伯语/西班牙语/法语等
3. **语气控制** - 正式/友好/简洁三种语气
4. **批量处理** - 支持大规模联系人列表

## 消息黄金法则
- 3秒内抓住注意力
- 首句直呼其名，避免群发感
- 简洁明了，WhatsApp 消息不超过 3 条
- 每条消息必须有 CTA（添加 WhatsApp / 回复 / 点击链接）

## 模板变量
- {{name}} - 客户姓名
- {{company}} - 客户公司
- {{product}} - 目标产品
- {{sender_name}} - 发件人姓名
- {{sender_company}} - 发件人公司

## 输出格式
生成的消息必须包含：
1. 个性化称呼
2. 自我介绍（简短）
3. 价值主张（为什么选我们）
4. 行动号召（CTA）

## 多语言注意事项
- 阿拉伯语：RTL，从右到左，需用 Unicode 格式
- 中文：正式场合用"您好"，口语可用"嗨"
- 西班牙语：区分西班牙/拉美口吻

给出消息后，标注适用场景和优化建议`,

  /**
   * 生成单条 WhatsApp 消息
   * @param {Object} params
   * @returns {Promise<string>}
   */
  async generateMessage(params = {}) {
    const { name, company, product, language, tone, sender } = params;
    const { getWhatsAppMessage } = await import('../tools/message-template.js');
    return getWhatsAppMessage({ name, company, product, language, tone, sender });
  },

  /**
   * 批量生成 WhatsApp 消息
   * @param {Array} contacts - 联系人数组 [{name, company, product, phone, language, tone}]
   * @param {Object} options - 全局选项
   * @returns {Array}
   */
  batchGenerate(contacts = [], options = {}) {
    return batchGenerateWhatsApp(contacts, options);
  },

  /**
   * CLI 批量生成并输出
   * @param {Array} contacts
   * @param {Object} options
   * @returns {string}
   */
  cliBatchGenerate(contacts = [], options = {}) {
    const results = this.batchGenerate(contacts, options);
    return formatWhatsAppOutput(results);
  },

  /**
   * AI 增强生成（使用 LLM 优化消息）
   * @param {Object} params
   * @returns {Promise<string>}
   */
  async aiEnhance(params = {}) {
    const { name, company, product, language, tone, sender, industry, target } = params;
    const config = getConfig();

    const prompt = `请为以下客户生成一条优化的 WhatsApp 外展消息：

客户信息：
- 姓名：${name}
- 公司：${company}
- 产品：${product}
- 语言：${language}（${SUPPORTED_LANGUAGES[language] || language}）
- 语气：${tone}（${TONES[tone] || tone}）
- 行业背景：${industry || 'B2B外贸'}

发件人：
- 姓名：${sender.name}
- 公司：${sender.company || config.sender_company || ''}
- 邮箱：${sender.email || config.sender_email || ''}

要求：
1. 个性化，直呼客户姓名
2. 简洁，WhatsApp 单条消息不超过 160 字符
3. 有价值主张
4. 有 CTA
5. 自然不生硬，像真人发的
6. 直接输出消息内容，不要解释

输出格式：
[消息内容]`;

    try {
      const result = await chatWithAI(prompt, 'whatsapp');
      return result.trim();
    } catch (e) {
      // fallback 到模板
      const { getWhatsAppMessage } = await import('../tools/message-template.js');
      return getWhatsAppMessage({ name, company, product, language, tone, sender });
    }
  },

  /**
   * AI 批量增强（对每条消息进行 LLM 优化）
   * @param {Array} contacts
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async aiBatchEnhance(contacts = [], options = {}) {
    const results = [];
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      try {
        const message = await this.aiEnhance({
          name: contact.name,
          company: contact.company,
          product: contact.product || options.product,
          language: contact.language || options.language,
          tone: contact.tone || options.tone,
          sender: contact.sender || options.sender,
          industry: contact.industry
        });
        results.push({
          index: i + 1,
          phone: contact.phone || '',
          name: contact.name || '',
          company: contact.company || '',
          message,
          language: contact.language || options.language,
          tone: contact.tone || options.tone
        });
        // 限流：每条消息间隔 200ms
        if (i < contacts.length - 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (e) {
        results.push({
          index: i + 1,
          phone: contact.phone || '',
          name: contact.name || '',
          company: contact.company || '',
          message: `[生成失败] ${e.message}`,
          language: contact.language || options.language,
          tone: contact.tone || options.tone
        });
      }
    }
    return results;
  },

  /**
   * 打印帮助信息
   */
  printHelp() {
    console.log(chalk.bold('\n📱 WhatsApp 外展助手 使用指南\n'));
    console.log('━'.repeat(50));
    console.log(chalk.bold('\n【支持的语言】'));
    Object.entries(SUPPORTED_LANGUAGES).forEach(([code, name]) => {
      console.log(`  ${code.padEnd(6)} ${name}`);
    });
    console.log(chalk.bold('\n【支持的语气】'));
    Object.entries(TONES).forEach(([code, name]) => {
      console.log(`  ${code.padEnd(10)} ${name}`);
    });
    console.log(chalk.bold('\n【使用示例】'));
    console.log(`
  // 代码调用
  import { whatsappAgent } from './agents/whatsapp-agent.js';

  // 单条消息
  const msg = await whatsappAgent.aiEnhance({
    name: '张三',
    company: 'ABC Trading',
    product: '挖掘机',
    language: 'en',
    tone: 'friendly',
    sender: { name: '李四', company: 'XYZ出口' }
  });

  // 批量生成
  const contacts = [
    { name: 'John', company: 'ABC Inc', product: '挖掘机', phone: '+1234567890', language: 'en' },
    { name: '王五', company: '德企贸易', product: '挖掘机', phone: '+8613800000000', language: 'zh' }
  ];
  const results = whatsappAgent.batchGenerate(contacts, {
    product: '挖掘机',
    tone: 'formal',
    sender: { name: '李四', company: 'XYZ出口' }
  });
  console.log(whatsappAgent.cliBatchGenerate(contacts, {...}));

  // AI 批量优化
  const aiResults = await whatsappAgent.aiBatchEnhance(contacts, {...});
`);
    console.log('━'.repeat(50) + '\n');
  }
};

// 注册到 agents/index.js
export default whatsappAgent;

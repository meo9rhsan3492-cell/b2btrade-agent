/**
 * B2Btrade-agent LinkedIn 外展文案助手
 * 专注：个性化连接请求 + 第一条私信草稿生成
 */

import chalk from 'chalk';
import { info, warn, error, debug, logAction } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { scrapeLinkedInProfile, scrapeLinkedInCompany, searchLinkedInViaGoogle } from '../tools/linkedin-scrape.js';

/**
 * LinkedIn Agent 配置
 */
const LINKEDIN_AGENT_CONFIG = {
  maxBatchSize: 20,           // 批量处理最大数量
  defaultLanguage: 'zh-CN',   // 默认语言
  toneOptions: ['professional', 'friendly', 'formal', 'casual'],
  includeCustomFields: true,   // 是否包含自定义字段
};

/**
 * 生成个性化连接请求草稿
 * @param {Object} profile - LinkedIn 档案数据
 * @param {Object} options - 生成选项
 * @returns {Object} 连接请求草稿
 */
export async function generateConnectRequest(profile, options = {}) {
  const { name, title, company, location, summary, recentActivity } = profile;
  const { tone = 'professional', customMessage = '' } = options;

  const toneStyles = {
    professional: {
      prefix: 'Hi',
      suffix: 'Would love to connect.',
      maxLength: 140,
    },
    friendly: {
      prefix: 'Hey',
      suffix: 'Great connecting with you!',
      maxLength: 150,
    },
    formal: {
      prefix: 'Dear',
      suffix: 'I look forward to connecting with you.',
      maxLength: 130,
    },
    casual: {
      prefix: 'Hi',
      suffix: 'Cheers!',
      maxLength: 160,
    },
  };

  const style = toneStyles[tone] || toneStyles.professional;

  // 构建钩子句（基于职位/公司/动态）
  let hook = '';
  if (recentActivity) {
    hook = `Saw your recent post about ${recentActivity.topic || 'your work'} — `;
  } else if (company && title) {
    hook = `Impressed by ${company}'s work in ${title} — `;
  } else if (title) {
    hook = `Following your work as ${title} — `;
  } else {
    hook = `Found your profile and impressed — `;
  }

  // 构建中间段
  let middle = '';
  if (summary) {
    middle = `your background in ${summary.slice(0, 60)}... `;
  }

  // 个性化备注（如果有）
  const custom = customMessage ? ` Also: ${customMessage}` : '';

  const fullText = `${hook}${middle}${style.suffix}${custom}`.trim();

  // 截断到限制长度
  const finalText = fullText.length > style.maxLength
    ? fullText.slice(0, style.maxLength - 3) + '...'
    : fullText;

  return {
    text: finalText,
    charCount: finalText.length,
    tone,
    hook,
    character: `${style.prefix} ${name || 'there'}`,
    suggestedEdit: `建议在"添加备注"中添加：${company ? `${company} ` : ''}${title ? title : ''}，一句话说明来源`,
    autoSendWarning: '⚠️ 请人工审核后再发送，LinkedIn 限制连接请求变更',
  };
}

/**
 * 生成第一条私信草稿
 * @param {Object} profile - LinkedIn 档案数据
 * @param {Object} context - 业务上下文（产品/目的）
 * @param {Object} options - 生成选项
 * @returns {Object} 私信草稿
 */
export async function generateFirstMessage(profile, context = {}, options = {}) {
  const { name, title, company, location, recentActivity } = profile;
  const { product = '', purpose = '', reference = '' } = context;
  const { tone = 'professional', language = 'zh-CN' } = options;

  const salutation = `Hi ${name || 'there'}`;

  // 开场钩子（基于动态或职位）
  let opener = '';
  if (recentActivity) {
    opener = `Congrats on ${recentActivity.topic || 'the recent update'}! `;
  } else if (title && company) {
    opener = `Your work at ${company} as ${title} caught my attention. `;
  } else if (title) {
    opener = `Impressive profile as ${title}! `;
  } else {
    opener = `Great to connect with you! `;
  }

  // 价值主张
  let valueProp = '';
  if (product) {
    if (purpose === 'partnership') {
      valueProp = `We help companies like ${company || 'yours'} with ${product} — `;
    } else if (purpose === 'sales') {
      valueProp = `Thought you might be interested in our ${product} — `;
    } else {
      valueProp = `Wanted to share how we support ${product} — `;
    }
  } else {
    valueProp = 'We specialize in helping businesses expand internationally. ';
  }

  // 参考来源
  const ref = reference ? ` (found you via ${reference})` : '';

  // CTA
  const cta = purpose === 'partnership'
    ? 'Would love to explore potential synergies. Open to a quick call?'
    : purpose === 'sales'
      ? 'Would you be open to a brief call to discuss how we can help?'
      : 'Would love to connect and learn more about your work.';

  const message = `${salutation},\n\n${opener}${valueProp}${ref}\n\n${cta}\n\nBest regards`.trim();

  // 多语言版本（英文为主，附加中文备注）
  const notes = [];
  if (language === 'zh-CN') {
    notes.push(`【发送对象】${title || '未知'} @ ${company || '未知公司'} (${location || '未知地区'})`);
    notes.push(`【产品背景】${product || '通用'} | 目的: ${purpose || '建立联系'}`);
    if (recentActivity) {
      notes.push(`【切入点】参考了对方最近的动态: ${recentActivity.topic}`);
    }
  }

  return {
    text: message,
    charCount: message.length,
    tone,
    salutation,
    suggestedSubject: purpose === 'sales' ? `Quick question about ${product}` : undefined,
    notes,
    reviewChecklist: [
      '✓ 确认对方职位/公司信息准确',
      '✓ 确认产品描述与对方需求匹配',
      '✓ 删除 ref 来源（如果是内部备注）',
      '✓ 确认语言语气适当',
    ],
    warning: '⚠️ 私信草稿，请人工审核后发送',
  };
}

/**
 * 批量处理多个 LinkedIn 目标
 * @param {Array} targets - 目标列表 (URL 或对象)
 * @param {Object} context - 业务上下文
 * @param {Object} options - 批量处理选项
 * @returns {Object} 批量处理结果
 */
export async function batchGenerateOutreach(targets, context = {}, options = {}) {
  const { maxBatchSize = LINKEDIN_AGENT_CONFIG.maxBatchSize } = options;
  const results = [];
  const errors = [];

  // 限制批量大小
  const batch = targets.slice(0, maxBatchSize);

  info('LinkedInAgent', `开始批量处理 ${batch.length} 个目标...`);

  for (let i = 0; i < batch.length; i++) {
    const target = batch[i];
    const index = i + 1;

    try {
      console.log(chalk.blue(`  [${index}/${batch.length}] 处理中...`));

      // 判断是个人还是公司
      const isCompany = typeof target === 'string'
        ? target.includes('/company/') || target.includes('/school/')
        : (target.url && (target.url.includes('/company/') || target.url.includes('/school/')));

      let profile;
      if (isCompany) {
        profile = await scrapeLinkedInCompany(typeof target === 'string' ? target : target.url);
      } else {
        profile = await scrapeLinkedInProfile(typeof target === 'string' ? target : target.url);
      }

      // 生成连接请求
      const connectRequest = await generateConnectRequest(profile, {
        tone: options.tone || 'professional',
        customMessage: options.customMessage || '',
      });

      // 生成私信
      const firstMessage = await generateFirstMessage(profile, context, {
        tone: options.tone || 'professional',
        language: options.language || LINKEDIN_AGENT_CONFIG.defaultLanguage,
      });

      results.push({
        index,
        url: profile.sourceUrl,
        name: profile.name,
        title: profile.title,
        company: profile.company,
        location: profile.location,
        connectRequest,
        firstMessage,
        status: 'ready',
      });

      debug('LinkedInAgent', `处理完成: ${profile.name || 'unknown'}`);

    } catch (err) {
      error('LinkedInAgent', `处理失败 [${index}]: ${err.message}`);
      errors.push({
        index,
        url: typeof target === 'string' ? target : target.url,
        error: err.message,
        status: 'failed',
      });
    }
  }

  info('LinkedInAgent', `批量处理完成: ${results.length} 成功, ${errors.length} 失败`);

  return {
    summary: {
      total: targets.length,
      processed: results.length,
      failed: errors.length,
      successRate: targets.length > 0 ? ((results.length / targets.length) * 100).toFixed(1) + '%' : '0%',
    },
    results,
    errors,
    exportData: formatExportData(results, context),
  };
}

/**
 * 格式化导出数据
 * @param {Array} results - 处理结果
 * @param {Object} context - 业务上下文
 * @returns {string} Markdown 格式数据
 */
function formatExportData(results, context) {
  if (results.length === 0) return '';

  const timestamp = new Date().toISOString().split('T')[0];
  const lines = [
    `# LinkedIn 外展草稿 - ${timestamp}`,
    '',
    `## 任务背景`,
    `- 产品/服务: ${context.product || '未指定'}`,
    `- 目的: ${context.purpose || '建立联系'}`,
    `- 目标数量: ${results.length}`,
    '',
    '---\n',
  ];

  results.forEach((r, i) => {
    lines.push(`## ${i + 1}. ${r.name || '未知'} @ ${r.company || '未知公司'}`);
    lines.push(`- 职位: ${r.title || '未知'}`);
    lines.push(`- 地区: ${r.location || '未知'}`);
    lines.push(`- 来源: ${r.url}`);
    lines.push('');
    lines.push(`### 连接请求`);
    lines.push(`> ${r.connectRequest.text}`);
    lines.push('');
    lines.push(`### 第一条私信`);
    lines.push(`> ${r.firstMessage.text}`);
    lines.push('');
    lines.push(`### 人工审核清单`);
    r.firstMessage.reviewChecklist?.forEach(item => lines.push(`- ${item}`));
    lines.push('');
    lines.push('---\n');
  });

  lines.push('## ⚠️ 重要提醒');
  lines.push('1. 所有内容必须人工审核后再发送');
  lines.push('2. 确认对方信息准确性');
  lines.push('3. 不要发送未经个性化修改的模板内容');
  lines.push('4. LinkedIn 有每日连接请求上限（约100-200/天）');
  lines.push('');

  return lines.join('\n');
}

/**
 * 主入口：生成 LinkedIn 外展文案
 * @param {string|Array} input - LinkedIn URL 或 URL 列表
 * @param {Object} context - 业务上下文
 * @param {Object} options - 选项
 * @returns {Object} 生成结果
 */
export async function generateLinkedInOutreach(input, context = {}, options = {}) {
  const startTime = Date.now();

  logAction('linkedin_outreach', '开始生成 LinkedIn 外展文案', {
    inputType: Array.isArray(input) ? 'batch' : 'single',
    count: Array.isArray(input) ? input.length : 1,
    product: context.product,
  });

  try {
    // 单个目标
    if (!Array.isArray(input)) {
      const isCompany = input.includes('/company/') || input.includes('/school/');
      const profile = isCompany
        ? await scrapeLinkedInProfile(input)
        : await scrapeLinkedInProfile(input);

      const connectRequest = await generateConnectRequest(profile, options);
      const firstMessage = await generateFirstMessage(profile, context, options);

      return {
        profile,
        connectRequest,
        firstMessage,
        batchMode: false,
      };
    }

    // 批量处理
    const batchResult = await batchGenerateOutreach(input, context, options);
    return {
      ...batchResult,
      batchMode: true,
    };

  } catch (err) {
    error('LinkedInAgent', `生成失败: ${err.message}`);
    throw err;
  } finally {
    const duration = Date.now() - startTime;
    info('LinkedInAgent', `完成，耗时 ${duration}ms`);
  }
}

/**
 * LinkedIn Agent 定义（兼容 agents/index.js 格式）
 */
export const linkedinAgent = {
  id: 'linkedin',
  name: '💼 LinkedIn 外展',
  role: 'LinkedIn 文案生成',
  description: '个性化连接请求 + 私信草稿',
  systemPrompt: `# 角色：LinkedIn B2B 外展文案专家

你专精于 LinkedIn B2B 销售与招聘外展：

## 核心能力
1. **连接请求文案** — 3秒钩子，专业简洁，不超过 140 字符
2. **第一条私信** — 个性化开场 + 价值主张 + CTA
3. **批量处理** — 一次处理多个目标，批量导出 Markdown

## 文案原则
- 钩子句必须基于对方职位/公司/动态定制
- 避免泛泛而谈，强调具体价值
- 语气根据目标人群调整（Professional/Friendly/Formal）
- 不使用模板套话

## 隐私与合规
- ⚠️ 不登录、不自动化操作
- ⚠️ 仅生成文案，内容需人工审核
- ⚠️ 遵守 LinkedIn 用户协议

## 输入格式
单个目标：LinkedIn 个人主页 URL
批量目标：[URL1, URL2, ...]
业务上下文：{ product, purpose, reference }

## 输出格式
1. 个性化连接请求草稿（<140字）
2. 第一条私信草稿（可编辑）
3. 人工审核清单
4. Markdown 批量导出`,
};

/**
 * intentMap 关键词映射
 */
export const linkedinIntentMap = {
  'linkedin': 'linkedin',
  '领英': 'linkedin',
  '连接请求': 'linkedin',
  '私信': 'linkedin',
  'outreach': 'linkedin',
  'connection request': 'linkedin',
};

export default {
  linkedinAgent,
  generateLinkedInOutreach,
  generateConnectRequest,
  generateFirstMessage,
  batchGenerateOutreach,
  linkedinIntentMap,
};
